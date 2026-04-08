import { NextResponse } from "next/server";
import { crmClient, DEFAULT_ORG_ID } from "@/lib/crmdb";
import { emitEvent } from "@/lib/river";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = crmClient();
  const { data, error } = await sb
    .from("estimates")
    .update({ sent_at: new Date().toISOString() })
    .eq("id", id)
    .select("*, opportunities(customer_id, customers(customer_name, customer_phone, customer_email))")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const cust = (data as { opportunities?: { customers?: Record<string, unknown> } })
    ?.opportunities?.customers ?? {};

  await emitEvent(sb, {
    org_id: DEFAULT_ORG_ID,
    type: "estimate.sent",
    related_type: "estimate",
    related_id: id,
    payload: {
      estimate_id: id,
      opportunity_id: data.opportunity_id,
      amount: data.amount,
      customer_id: (data as { opportunities?: { customer_id?: string } })?.opportunities?.customer_id,
      customer_name: cust.customer_name,
      customer_phone: cust.customer_phone,
      customer_email: cust.customer_email,
    },
  });

  return NextResponse.json({ estimate: data });
}
