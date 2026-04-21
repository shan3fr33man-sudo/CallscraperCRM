import { NextResponse } from "next/server";
import { crmClient } from "@/lib/crmdb";
import { getOrgId } from "@/lib/auth";
import { emitEvent } from "@/lib/river";

export const runtime = "nodejs";

/**
 * POST /api/invoices/[id]/send — send invoice via email/sms (logs to email_logs/sms_logs).
 * Body: { channel?: "email"|"sms"|"both", to?, message? }
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

  const { data: invoice, error } = await sb
    .from("invoices")
    .update({ status: "sent", issued_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", orgId)
    .select("*, customers(customer_name, customer_phone, customer_email)")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const cust = (invoice as { customers?: Record<string, unknown> }).customers ?? {};
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const pdfUrl = `${baseUrl}/api/invoices/${id}/pdf`;

  if ((channel === "email" || channel === "both") && cust.customer_email) {
    await sb.from("email_logs").insert({
      org_id: orgId,
      customer_id: invoice.customer_id,
      template_key: "invoice.sent",
      to_email: body.to ?? (cust.customer_email as string),
      from_email: process.env.DEFAULT_FROM_EMAIL ?? "billing@example.com",
      subject: `Invoice ${invoice.invoice_number} — $${invoice.amount_due}`,
      body:
        body.message ??
        `Hi ${cust.customer_name ?? "there"},\n\nYour invoice ${invoice.invoice_number} for $${invoice.amount_due} is ready.\nDue: ${invoice.due_date}\n\nDownload: ${pdfUrl}`,
      status: "queued",
      related_type: "invoice",
      related_id: id,
    });
  }
  if ((channel === "sms" || channel === "both") && cust.customer_phone) {
    await sb.from("sms_logs").insert({
      org_id: orgId,
      customer_id: invoice.customer_id,
      template_key: "invoice.sent",
      to_number: body.to ?? (cust.customer_phone as string),
      from_number: process.env.DEFAULT_FROM_NUMBER ?? null,
      message:
        body.message ??
        `Invoice ${invoice.invoice_number}: $${invoice.amount_due} due ${invoice.due_date}. View: ${pdfUrl}`,
      status: "queued",
      related_type: "invoice",
      related_id: id,
    });
  }

  await emitEvent(sb, {
    org_id: orgId,
    type: "invoice.sent",
    related_type: "invoice",
    related_id: id,
    payload: { invoice_id: id, amount_due: invoice.amount_due, customer_id: invoice.customer_id, pdf_url: pdfUrl, channel },
  });

  return NextResponse.json({ invoice, pdf_url: pdfUrl });
}
