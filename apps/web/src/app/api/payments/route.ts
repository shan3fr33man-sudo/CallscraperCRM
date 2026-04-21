import { NextResponse } from "next/server";
import { crmClient } from "@/lib/crmdb";
import { getOrgId } from "@/lib/auth";
import { emitEvent } from "@/lib/river";

export const runtime = "nodejs";

/** GET /api/payments — list payments (filterable). */
export async function GET(req: Request) {
  const sb = crmClient();
  const orgId = await getOrgId();
  const { searchParams } = new URL(req.url);
  const invoiceId = searchParams.get("invoice_id");
  const estimateId = searchParams.get("estimate_id");
  const customerId = searchParams.get("customer_id");

  let q = sb.from("payments").select("*").eq("org_id", orgId);
  if (invoiceId) q = q.eq("invoice_id", invoiceId);
  if (estimateId) q = q.eq("estimate_id", estimateId);
  if (customerId) q = q.eq("customer_id", customerId);

  const { data, error } = await q.order("created_at", { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ payments: data ?? [] });
}

/**
 * POST /api/payments — record a payment.
 * Body: { amount, method ("card"|"cash"|"check"|"ach"), invoice_id?, estimate_id?, customer_id?, reference?, status? }
 *
 * If estimate_id is set and method is cash/check (manual), we mark deposit_paid_at on the estimate.
 * Stripe card payments will go through /api/payments/create-intent in Phase 4.
 */
export async function POST(req: Request) {
  const body = (await req.json()) as Record<string, unknown>;
  if (typeof body.amount !== "number" || body.amount <= 0) {
    return NextResponse.json({ error: "amount required" }, { status: 400 });
  }
  if (!body.method) {
    return NextResponse.json({ error: "method required" }, { status: 400 });
  }
  const sb = crmClient();
  const orgId = await getOrgId();

  const { data, error } = await sb
    .from("payments")
    .insert({
      org_id: orgId,
      invoice_id: body.invoice_id ?? null,
      estimate_id: body.estimate_id ?? null,
      customer_id: body.customer_id ?? null,
      amount: body.amount,
      method: body.method,
      status: body.status ?? "completed", // manual entries are immediately completed
      reference: body.reference ?? null,
      processed_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Side-effects
  if (body.estimate_id && (body.method === "cash" || body.method === "check")) {
    await sb
      .from("estimates")
      .update({ deposit_paid_at: new Date().toISOString() })
      .eq("id", body.estimate_id)
      .eq("org_id", orgId);
  }

  if (body.invoice_id) {
    // Update invoice amount_paid + balance + status
    const { data: inv } = await sb
      .from("invoices")
      .select("amount_due, amount_paid, balance")
      .eq("id", body.invoice_id)
      .eq("org_id", orgId)
      .maybeSingle();
    if (inv) {
      const newPaid = (Number(inv.amount_paid) || 0) + body.amount;
      const newBalance = Math.max(0, (Number(inv.amount_due) || 0) - newPaid);
      const newStatus = newBalance <= 0 ? "paid" : "partial";
      await sb
        .from("invoices")
        .update({
          amount_paid: newPaid,
          balance: newBalance,
          status: newStatus,
          paid_at: newBalance <= 0 ? new Date().toISOString() : null,
          payment_method: body.method,
          payment_reference: body.reference ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", body.invoice_id);
    }
  }

  await emitEvent(sb, {
    org_id: orgId,
    type: "payment.received",
    related_type: "payment",
    related_id: data.id,
    payload: {
      payment_id: data.id,
      amount: data.amount,
      method: data.method,
      invoice_id: data.invoice_id,
      estimate_id: data.estimate_id,
      customer_id: data.customer_id,
    },
  });

  return NextResponse.json({ payment: data });
}
