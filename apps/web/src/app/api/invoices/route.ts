import { NextResponse } from "next/server";
import { crmClient } from "@/lib/crmdb";
import { getOrgId } from "@/lib/auth";
import { emitEvent } from "@/lib/river";

export const runtime = "nodejs";

/** GET /api/invoices — list invoices (filterable by status, customer_id, job_id, opportunity_id). */
export async function GET(req: Request) {
  const sb = crmClient();
  const orgId = await getOrgId();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const customerId = searchParams.get("customer_id");
  const jobId = searchParams.get("job_id");
  const oppId = searchParams.get("opportunity_id");
  const overdue = searchParams.get("overdue") === "true";

  let q = sb.from("invoices").select("*").eq("org_id", orgId);
  if (status) q = q.eq("status", status);
  if (customerId) q = q.eq("customer_id", customerId);
  if (jobId) q = q.eq("job_id", jobId);
  if (oppId) q = q.eq("opportunity_id", oppId);
  if (overdue) {
    q = q.in("status", ["sent", "partial"]).lt("due_date", new Date().toISOString().slice(0, 10));
  }
  const { data, error } = await q.order("created_at", { ascending: false }).limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ invoices: data ?? [] });
}

/** POST /api/invoices — manual invoice creation. */
export async function POST(req: Request) {
  const body = (await req.json()) as Record<string, unknown>;
  const sb = crmClient();
  const orgId = await getOrgId();

  const lineItems = (body.line_items_json ?? []) as Array<{ subtotal: number }>;
  const subtotal = (body.subtotal as number | undefined) ??
    lineItems.reduce((s, li) => s + (Number(li.subtotal) || 0), 0);
  const discounts = (body.discounts as number) ?? 0;
  const sales_tax = (body.sales_tax as number) ?? 0;
  const amount_due = (body.amount_due as number | undefined) ??
    Math.max(0, subtotal - discounts + sales_tax);

  const { data, error } = await sb
    .from("invoices")
    .insert({
      org_id: orgId,
      job_id: body.job_id ?? null,
      opportunity_id: body.opportunity_id ?? null,
      customer_id: body.customer_id ?? null,
      estimate_id: body.estimate_id ?? null,
      invoice_number: body.invoice_number ?? `INV-${Date.now().toString(36).toUpperCase()}`,
      status: body.status ?? "draft",
      line_items_json: lineItems,
      subtotal,
      discounts,
      sales_tax,
      amount_due,
      amount_paid: 0,
      balance: amount_due,
      due_date: body.due_date ?? null,
      notes: body.notes ?? null,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await emitEvent(sb, {
    org_id: orgId,
    type: "invoice.created",
    related_type: "invoice",
    related_id: data.id,
    payload: { invoice_id: data.id, amount_due: data.amount_due, customer_id: data.customer_id },
  });

  return NextResponse.json({ invoice: data });
}
