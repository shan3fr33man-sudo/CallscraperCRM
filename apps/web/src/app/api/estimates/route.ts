import { NextResponse } from "next/server";
import { crmClient, DEFAULT_ORG_ID } from "@/lib/crmdb";
import { emitEvent } from "@/lib/river";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json()) as Record<string, unknown>;
  const sb = crmClient();
  const { data, error } = await sb
    .from("estimates")
    .insert({
      org_id: DEFAULT_ORG_ID,
      opportunity_id: body.opportunity_id,
      charges_json: body.charges_json ?? [],
      subtotal: body.subtotal ?? 0,
      discounts: body.discounts ?? 0,
      sales_tax: body.sales_tax ?? 0,
      amount: body.amount ?? (body.estimated_total ?? 0),
      valid_until: body.valid_until ?? null,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await emitEvent(sb, {
    org_id: DEFAULT_ORG_ID,
    type: "estimate.created",
    related_type: "estimate",
    related_id: data.id,
    payload: { estimate_id: data.id, opportunity_id: data.opportunity_id, amount: data.amount },
  });
  return NextResponse.json({ estimate: data });
}
