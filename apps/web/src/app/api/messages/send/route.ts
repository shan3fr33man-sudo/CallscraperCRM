import { NextResponse } from "next/server";
import { crmClient } from "@/lib/crmdb";
import { requireOrgId } from "@/lib/auth";
import { emitEvent } from "@/lib/river";
import {
  DEFAULT_FROM_EMAIL,
  applyTestOverride,
  resolveResendKey,
  sendEmail,
} from "@/lib/resend";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let orgId: string;
  try { orgId = await requireOrgId(); }
  catch (res) { if (res instanceof Response) return res; throw res; }
  const body = (await req.json()) as Record<string, unknown>;
  const sb = crmClient();

  const channel = ((body.channel as string) ?? "sms").toLowerCase();

  if (channel === "email") {
    const requestedTo = (body.to_email as string) ?? "";
    const routed = applyTestOverride(requestedTo);
    const subject = (body.subject as string) ?? "";
    const message = (body.body as string) ?? (body.message as string) ?? "";

    // Insert email_logs row first (always audited, even if send fails)
    const { data, error } = await sb
      .from("email_logs")
      .insert({
        org_id: orgId,
        template_key: body.template_key ?? null,
        to_email: routed.to || null,
        from_email: (body.from_email as string) ?? DEFAULT_FROM_EMAIL,
        subject,
        body: message,
        status: "queued",
        related_type: body.related_type ?? null,
        related_id: body.related_id ?? null,
      })
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const apiKey = await resolveResendKey(sb, orgId);
    if (!apiKey) {
      // No Resend key available — leave row queued, caller will retry or we
      // backfill once the credential lands in integration_credentials.
      return NextResponse.json({
        message: data,
        sent: false,
        reason: "no_resend_api_key",
      });
    }

    if (!routed.to) {
      await sb
        .from("email_logs")
        .update({ status: "error", sent_at: new Date().toISOString() })
        .eq("id", data.id);
      return NextResponse.json({ error: "to_email required" }, { status: 400 });
    }

    const result = await sendEmail({
      apiKey,
      from: (body.from_email as string) ?? DEFAULT_FROM_EMAIL,
      to: routed.to,
      subject,
      body: routed.overridden
        ? `${message}\n\n---\n[test-routed from original: ${routed.original}]`
        : message,
    });

    const nextStatus = result.ok ? "sent" : "error";
    await sb
      .from("email_logs")
      .update({ status: nextStatus, sent_at: new Date().toISOString() })
      .eq("id", data.id);

    await emitEvent(sb, {
      org_id: orgId,
      type: result.ok ? "message.delivered" : "message.failed",
      related_type: String(body.related_type ?? "email"),
      related_id: String(body.related_id ?? data.id),
      payload: {
        template_key: body.template_key,
        email_id: data.id,
        provider: "resend",
        provider_id: result.provider_id,
        error: result.error,
      },
    });

    return NextResponse.json({
      message: data,
      sent: result.ok,
      provider_id: result.provider_id,
      error: result.error,
    });
  }

  // Default: SMS path (unchanged)
  const { data, error } = await sb
    .from("sms_logs")
    .insert({
      org_id: orgId,
      template_key: body.template_key ?? null,
      to_number: body.to_number ?? null,
      from_number: body.from_number ?? null,
      message: body.message ?? null,
      status: "queued",
      related_type: body.related_type ?? null,
      related_id: body.related_id ?? null,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await emitEvent(sb, {
    org_id: orgId,
    type: "message.queued",
    related_type: String(body.related_type ?? "message"),
    related_id: String(body.related_id ?? data.id),
    payload: { template_key: body.template_key, sms_id: data.id },
  });
  return NextResponse.json({ message: data });
}
