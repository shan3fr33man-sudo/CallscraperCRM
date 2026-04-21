import { NextResponse } from "next/server";
import { crmClient } from "@/lib/crmdb";
import { getOrgId } from "@/lib/auth";

export const runtime = "nodejs";

/** GET /api/tariffs/[id]/rates — list rates for a tariff. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = crmClient();
  const orgId = await getOrgId();
  // Verify tariff belongs to org
  const { data: tariff } = await sb.from("tariffs").select("id").eq("id", id).eq("org_id", orgId).maybeSingle();
  if (!tariff) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { data, error } = await sb.from("tariff_rates").select("*").eq("tariff_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rates: data ?? [] });
}

/** POST /api/tariffs/[id]/rates — add a rate. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as Record<string, unknown>;
  const sb = crmClient();
  const orgId = await getOrgId();

  const { data: tariff } = await sb.from("tariffs").select("id").eq("id", id).eq("org_id", orgId).maybeSingle();
  if (!tariff) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { data, error } = await sb
    .from("tariff_rates")
    .insert({
      tariff_id: id,
      kind: body.kind ?? "labor",
      label: body.label ?? null,
      base_rate: body.base_rate ?? 0,
      min_charge: body.min_charge ?? 0,
      unit: body.unit ?? "hour",
      conditions_json: body.conditions_json ?? {},
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rate: data });
}
