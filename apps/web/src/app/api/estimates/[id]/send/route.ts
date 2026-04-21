import { NextResponse } from "next/server";
import { crmClient } from "@/lib/crmdb";
import { getOrgId } from "@/lib/auth";
import { emitEvent } from "@/lib/river";

export const runtime = "nodejs";

/**
 * POST /api/estimates/[id]/send
 *
 * Body: { channel?: "email" | "sms" | "both", to?: string, message?: string }
 *
 * Marks estimate as sent, generates a public view link, and writes an email_log
 * (with PDF link) and/or sms_log entry. Stub provider — actual delivery wires
 * in Phase 4 (Twilio/Resend). Emits estimate.sent for the river.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    channel?: "email" | "sms" | "both";
    to?: string;
    message?: string;
  };
  const channel = body.channel ?? "email";
  const sb = crmClient();
  const orgId = await getOrgId();

  const { data, error } = await sb
    .from("estimates")
    .update({ sent_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", orgId)
    .select("*, opportunities(customer_id, customers(customer_name, customer_phone, customer_email))")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const oppRel = (data as { opportunities?: { customer_id?: string; customers?: Record<string, unknown> } })
    ?.opportunities;
  const cust = oppRel?.customers ?? {};
  const customerId = oppRel?.customer_id ?? null;

  // Build the public view URL with a signed token (id-based for v1.1; HMAC in v1.2)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const viewUrl = `${baseUrl}/estimate/${id}`;
  const pdfUrl = `${baseUrl}/api/estimates/${id}/pdf`;

  const sendEmail = channel === "email" || channel === "both";
  const sendSms = channel === "sms" || channel === "both";
  const recipientEmail = (body.to && channel === "email") ? body.to : (cust.customer_email as string | undefined);
  const recipientPhone = (body.to && channel === "sms") ? body.to : (cust.customer_phone as string | undefined);

  // Email log
  if (sendEmail && recipientEmail) {
    await sb.from("email_logs").insert({
      org_id: orgId,
      customer_id: customerId,
      template_key: "estimate.sent",
      to_email: recipientEmail,
      from_email: process.env.DEFAULT_FROM_EMAIL ?? "estimates@example.com",
      subject: `Your moving estimate #${(data.estimate_number as string | null) ?? id.slice(0, 8).toUpperCase()}`,
      body:
        body.message ??
        `Hi ${cust.customer_name ?? "there"},\n\nYour estimate is ready. View and sign here: ${viewUrl}\n\nDownload PDF: ${pdfUrl}\n\nTotal: $${data.amount}\n`,
      status: "queued",
      related_type: "estimate",
      related_id: id,
    });
  }

  // SMS log (column is `message`, not `body`)
  if (sendSms && recipientPhone) {
    await sb.from("sms_logs").insert({
      org_id: orgId,
      customer_id: customerId,
      template_key: "estimate.sent",
      to_number: recipientPhone,
      from_number: process.env.DEFAULT_FROM_NUMBER ?? null,
      message:
        body.message ??
        `Your moving estimate is ready. View & sign: ${viewUrl} (Total $${data.amount})`,
      status: "queued",
      related_type: "estimate",
      related_id: id,
    });
  }

  await emitEvent(sb, {
    org_id: orgId,
    type: "estimate.sent",
    related_type: "estimate",
    related_id: id,
    payload: {
      estimate_id: id,
      opportunity_id: data.opportunity_id,
      amount: data.amount,
      customer_id: customerId,
      customer_name: cust.customer_name,
      customer_phone: cust.customer_phone,
      customer_email: cust.customer_email,
      channel,
      view_url: viewUrl,
      pdf_url: pdfUrl,
    },
  });

  return NextResponse.json({
    estimate: data,
    view_url: viewUrl,
    pdf_url: pdfUrl,
    delivery: { email: sendEmail && Boolean(recipientEmail), sms: sendSms && Boolean(recipientPhone) },
  });
}
