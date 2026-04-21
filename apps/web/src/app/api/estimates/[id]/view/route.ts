import { NextResponse } from "next/server";
import { crmClient } from "@/lib/crmdb";

export const runtime = "nodejs";

/**
 * GET /api/estimates/[id]/view
 *
 * Public read-only endpoint for customer-facing estimate page. No auth — relies on
 * the estimate id being unguessable (UUID). v1.2 will add HMAC-signed token verification.
 * Returns minimal data needed to render the customer view.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = crmClient();

  // No org filter — public route
  const { data, error } = await sb
    .from("estimates")
    .select("*, opportunities(branch_id, service_date, origin_json, destination_json, customers(customer_name, customer_email))")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const opp = (data as { opportunities?: Record<string, unknown> }).opportunities;
  const cust = (opp?.customers as Record<string, unknown> | undefined) ?? {};

  // Branch info for company display
  let branch: { name?: string; address?: string; phone?: string } = {};
  const branchId = opp?.branch_id as string | undefined;
  if (branchId) {
    const { data: b } = await sb.from("branches").select("name, address, phone").eq("id", branchId).maybeSingle();
    if (b) branch = b as typeof branch;
  }

  return NextResponse.json({
    estimate: {
      id: data.id,
      number: data.estimate_number ?? data.id.slice(0, 8).toUpperCase(),
      type: data.estimate_type,
      amount: data.amount,
      subtotal: data.subtotal,
      sales_tax: data.sales_tax,
      discounts: data.discounts,
      deposit_amount: data.deposit_amount,
      valid_until: data.valid_until,
      sent_at: data.sent_at,
      accepted_at: data.accepted_at,
      service_date: opp?.service_date,
      line_items: data.charges_json,
      origin: (opp?.origin_json as Record<string, unknown> | null)?.raw,
      destination: (opp?.destination_json as Record<string, unknown> | null)?.raw,
    },
    customer: {
      name: cust.customer_name ?? "",
      email: cust.customer_email ?? "",
    },
    company: branch,
  });
}
