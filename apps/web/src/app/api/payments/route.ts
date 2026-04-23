import { NextResponse } from "next/server";
import { crmClient } from "@/lib/crmdb";
import { requireOrgId } from "@/lib/auth";
import { emitEvent } from "@/lib/river";

export const runtime = "nodejs";

const VALID_METHODS = ["card", "cash", "check", "ach"] as const;
const VALID_STATUSES = ["pending", "completed", "failed", "refunded"] as const;
type PaymentMethod = (typeof VALID_METHODS)[number];
type PaymentStatus = (typeof VALID_STATUSES)[number];

/** GET /api/payments — list payments (filterable). */
export async function GET(req: Request) {
  let orgId: string;
  try { orgId = await requireOrgId(); }
  catch (res) { if (res instanceof Response) return res; throw res; }
  const sb = crmClient();
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
 *
 * Body: { amount, method, invoice_id?, estimate_id?, customer_id?, reference?, status? }
 *
 * The invoice rollup (amount_paid, balance, status, paid_at) is maintained by
 * the `trg_payments_recompute` trigger in migration 0006 — NOT by app code.
 * That closes the read-then-write race where two concurrent payments could
 * miscount. We only set `deposit_paid_at` on the estimate here because it is
 * not derivable from payments alone.
 */
export async function POST(req: Request) {
  const body = (await req.json()) as Record<string, unknown>;
  const amount = typeof body.amount === "number" ? body.amount : NaN;
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "amount must be a positive number" }, { status: 400 });
  }
  const method = String(body.method ?? "") as PaymentMethod;
  if (!VALID_METHODS.includes(method)) {
    return NextResponse.json(
      { error: `method must be one of: ${VALID_METHODS.join(", ")}` },
      { status: 400 },
    );
  }
  const status = (body.status ? String(body.status) : "completed") as PaymentStatus;
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: `status must be one of: ${VALID_STATUSES.join(", ")}` },
      { status: 400 },
    );
  }

  let orgId: string;
  try { orgId = await requireOrgId(); }
  catch (res) { if (res instanceof Response) return res; throw res; }
  const sb = crmClient();

  // Verify ownership of any referenced parent rows. Done in parallel.
  const [invRes, estRes] = await Promise.all([
    body.invoice_id
      ? sb
          .from("invoices")
          .select("id, opportunity_id, customer_id, estimate_id")
          .eq("id", body.invoice_id)
          .eq("org_id", orgId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    body.estimate_id
      ? sb
          .from("estimates")
          .select("id, opportunity_id, deposit_amount")
          .eq("id", body.estimate_id)
          .eq("org_id", orgId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (body.invoice_id && !invRes.data) {
    return NextResponse.json({ error: "invoice_id does not exist in this org" }, { status: 404 });
  }
  if (body.estimate_id && !estRes.data) {
    return NextResponse.json({ error: "estimate_id does not exist in this org" }, { status: 404 });
  }
  // Cross-link consistency: when both are passed, they must belong to the
  // same opportunity (or the invoice was generated FROM that estimate).
  if (invRes.data && estRes.data) {
    const inv = invRes.data as { opportunity_id: string | null; estimate_id: string | null };
    const est = estRes.data as { id: string; opportunity_id: string | null };
    const sameOpp = inv.opportunity_id && inv.opportunity_id === est.opportunity_id;
    const sameEstimate = inv.estimate_id && inv.estimate_id === est.id;
    if (!sameOpp && !sameEstimate) {
      return NextResponse.json(
        { error: "invoice_id and estimate_id do not belong to the same opportunity" },
        { status: 400 },
      );
    }
  }

  const { data, error } = await sb
    .from("payments")
    .insert({
      org_id: orgId,
      invoice_id: body.invoice_id ?? null,
      estimate_id: body.estimate_id ?? null,
      customer_id: body.customer_id ?? null,
      amount,
      method,
      status, // trg_payments_recompute fires on insert and re-rolls the invoice
      reference: body.reference ?? null,
      processed_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Deposit acknowledgement on the estimate. Only mark as paid when the
  // payment actually meets the configured deposit_amount (avoids a $1 cash
  // entry flipping a $500 deposit). Sum prior estimate payments too in case
  // the deposit is being paid in installments.
  if (body.estimate_id && estRes.data && (method === "cash" || method === "check" || method === "card")) {
    const est = estRes.data as { id: string; deposit_amount: number | null };
    const depositRequired = Number(est.deposit_amount ?? 0);
    if (depositRequired > 0) {
      const { data: priorPayments } = await sb
        .from("payments")
        .select("amount, status")
        .eq("estimate_id", body.estimate_id)
        .eq("status", "completed");
      const priorTotal = (priorPayments ?? []).reduce(
        (s, p) => s + Number((p as { amount: number }).amount ?? 0),
        0,
      );
      // Include the payment we just inserted (status defaults to "completed")
      const totalForEstimate = priorTotal + (status === "completed" ? amount : 0);
      if (totalForEstimate >= depositRequired) {
        await sb
          .from("estimates")
          .update({ deposit_paid_at: new Date().toISOString() })
          .eq("id", body.estimate_id)
          .eq("org_id", orgId)
          .is("deposit_paid_at", null);
      }
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
