import { NextResponse } from "next/server";
import { crmClient } from "@/lib/crmdb";
import { getOrgId } from "@/lib/auth";

export const runtime = "nodejs";

async function verifyTariff(
  sb: ReturnType<typeof crmClient>,
  tariffId: string,
  orgId: string,
): Promise<boolean> {
  const { data } = await sb.from("tariffs").select("id").eq("id", tariffId).eq("org_id", orgId).maybeSingle();
  return Boolean(data);
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = crmClient();
  const orgId = await getOrgId();
  if (!(await verifyTariff(sb, id, orgId))) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { data, error } = await sb
    .from("tariff_modifiers")
    .select("*")
    .eq("tariff_id", id)
    .order("stacking_order");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ modifiers: data ?? [] });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as Record<string, unknown>;
  const sb = crmClient();
  const orgId = await getOrgId();
  if (!(await verifyTariff(sb, id, orgId))) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { data, error } = await sb
    .from("tariff_modifiers")
    .insert({
      tariff_id: id,
      kind: body.kind ?? "fuel_surcharge",
      label: body.label ?? null,
      formula_json: body.formula_json ?? { type: "percentage", value: 0 },
      stacking_order: body.stacking_order ?? 100,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ modifier: data });
}
