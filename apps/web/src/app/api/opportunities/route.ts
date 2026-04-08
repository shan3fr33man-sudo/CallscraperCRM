import { NextResponse } from "next/server";
import { crmClient, DEFAULT_ORG_ID } from "@/lib/crmdb";
import { emitEvent } from "@/lib/river";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json()) as Record<string, unknown>;
  const sb = crmClient();
  const { data, error } = await sb
    .from("opportunities")
    .insert({
      org_id: DEFAULT_ORG_ID,
      customer_id: body.customer_id ?? null,
      status: body.status ?? "new",
      service_type: body.service_type ?? null,
      service_date: body.service_date ?? null,
      move_type: body.move_type ?? null,
      move_size: body.move_size ?? null,
      brand: body.brand ?? null,
      opportunity_type: body.opportunity_type ?? null,
      source: body.source ?? null,
      amount: body.amount ?? 0,
      lead_quality: body.lead_quality ?? null,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await emitEvent(sb, {
    org_id: DEFAULT_ORG_ID,
    type: "opportunity.created",
    related_type: "opportunity",
    related_id: data.id,
    payload: {
      opportunity_id: data.id,
      customer_id: data.customer_id,
      status: data.status,
      amount: data.amount,
      lead_quality: data.lead_quality,
    },
  });

  return NextResponse.json({ opportunity: data });
}

export async function GET() {
  const sb = crmClient();
  const { data, error } = await sb
    .from("opportunities")
    .select("*")
    .eq("org_id", DEFAULT_ORG_ID)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ opportunities: data });
}
