import { NextResponse } from "next/server";
import { crmClient } from "@/lib/crmdb";
import { getOrgId } from "@/lib/auth";
import { emitEvent } from "@/lib/river";

export const runtime = "nodejs";

/**
 * POST /api/invoices/generate
 * Body: { estimate_id?, job_id?, due_in_days? }
 *
 * Auto-generates an invoice from an accepted estimate or completed job.
 * Copies line items, customer, opportunity link.
 */
export async function POST(req: Request) {
  const body = (await req.json()) as { estimate_id?: string; job_id?: string; due_in_days?: number };
  if (!body.estimate_id && !body.job_id) {
    return NextResponse.json({ error: "estimate_id or job_id required" }, { status: 400 });
  }
  const sb = crmClient();
  const orgId = await getOrgId();
  const dueIn = body.due_in_days ?? 14;
  const dueDate = new Date(Date.now() + dueIn * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  let estimate: Record<string, unknown> | null = null;
  let job: Record<string, unknown> | null = null;
  let customerId: string | null = null;
  let opportunityId: string | null = null;
  let lineItems: Array<Record<string, unknown>> = [];
  let subtotal = 0;
  let discounts = 0;
  let salesTax = 0;
  let amountDue = 0;

  if (body.estimate_id) {
    const { data, error } = await sb
      .from("estimates")
      .select("*, opportunities(customer_id, branch_id)")
      .eq("id", body.estimate_id)
      .eq("org_id", orgId)
      .maybeSingle();
    if (error || !data) return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
    estimate = data;
    opportunityId = data.opportunity_id as string | null;
    customerId = (data as { opportunities?: { customer_id?: string } })?.opportunities?.customer_id ?? null;
    lineItems = (data.charges_json as Array<Record<string, unknown>> | null) ?? [];
    subtotal = (data.subtotal as number) ?? 0;
    discounts = (data.discounts as number) ?? 0;
    salesTax = (data.sales_tax as number) ?? 0;
    amountDue = (data.amount as number) ?? 0;
  }

  if (body.job_id) {
    const { data, error } = await sb
      .from("jobs")
      .select("*, opportunities(customer_id, amount)")
      .eq("id", body.job_id)
      .eq("org_id", orgId)
      .maybeSingle();
    if (error || !data) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    job = data;
    opportunityId = data.opportunity_id as string | null;
    customerId =
      customerId ??
      ((data as { opportunities?: { customer_id?: string } })?.opportunities?.customer_id ?? null);
    if (!estimate) {
      // No estimate — pull amount from opportunity
      amountDue =
        ((data as { opportunities?: { amount?: number } })?.opportunities?.amount as number) ?? 0;
      subtotal = amountDue;
      lineItems = [{ label: `Move services (Job #${data.quote_number ?? body.job_id})`, subtotal: amountDue }];
    }
  }

  const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`;

  const { data: invoice, error: invErr } = await sb
    .from("invoices")
    .insert({
      org_id: orgId,
      job_id: body.job_id ?? null,
      opportunity_id: opportunityId,
      customer_id: customerId,
      estimate_id: body.estimate_id ?? null,
      invoice_number: invoiceNumber,
      status: "sent",
      line_items_json: lineItems,
      subtotal,
      discounts,
      sales_tax: salesTax,
      amount_due: amountDue,
      amount_paid: 0,
      balance: amountDue,
      due_date: dueDate,
      issued_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (invErr) return NextResponse.json({ error: invErr.message }, { status: 500 });

  await emitEvent(sb, {
    org_id: orgId,
    type: "invoice.created",
    related_type: "invoice",
    related_id: invoice.id,
    payload: {
      invoice_id: invoice.id,
      amount_due: invoice.amount_due,
      customer_id: customerId,
      opportunity_id: opportunityId,
      job_id: body.job_id ?? null,
      from_estimate: Boolean(body.estimate_id),
      from_job: Boolean(body.job_id),
    },
  });

  return NextResponse.json({ invoice });
}
