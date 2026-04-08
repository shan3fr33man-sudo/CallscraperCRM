import { NextResponse } from "next/server";
import { crmClient, DEFAULT_ORG_ID } from "@/lib/crmdb";
import { emitEvent } from "@/lib/river";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json()) as Record<string, unknown>;
  const sb = crmClient();
  const { data, error } = await sb
    .from("customers")
    .insert({
      org_id: DEFAULT_ORG_ID,
      customer_name: body.customer_name ?? null,
      customer_phone: body.customer_phone ?? null,
      customer_email: body.customer_email ?? null,
      brand: body.brand ?? null,
      source: body.source ?? null,
      status: body.status ?? "new",
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await emitEvent(sb, {
    org_id: DEFAULT_ORG_ID,
    type: "customer.created",
    related_type: "customer",
    related_id: data.id,
    payload: {
      customer_id: data.id,
      customer_name: data.customer_name,
      customer_phone: data.customer_phone,
      customer_email: data.customer_email,
    },
  });

  return NextResponse.json({ customer: data });
}

export async function GET() {
  const sb = crmClient();
  const { data, error } = await sb
    .from("customers")
    .select("*")
    .eq("org_id", DEFAULT_ORG_ID)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ customers: data });
}
