import { NextResponse } from "next/server";
import { crmClient } from "@/lib/crmdb";
import { getOrgId } from "@/lib/auth";

export const runtime = "nodejs";

async function verifyRateOwnership(
  sb: ReturnType<typeof crmClient>,
  tariffId: string,
  rateId: string,
  orgId: string,
): Promise<boolean> {
  const { data } = await sb
    .from("tariff_rates")
    .select("id, tariff_id, tariffs!inner(org_id)")
    .eq("id", rateId)
    .eq("tariff_id", tariffId)
    .maybeSingle();
  if (!data) return false;
  // PostgREST returns nested as object when using !inner with single FK; types think array
  const joined = (data as unknown as { tariffs: { org_id: string } | { org_id: string }[] }).tariffs;
  const orgFromJoin = Array.isArray(joined) ? joined[0]?.org_id : joined?.org_id;
  return orgFromJoin === orgId;
}

/** PATCH /api/tariffs/[id]/rates/[rateId] — update a rate. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; rateId: string }> },
) {
  const { id, rateId } = await params;
  const body = (await req.json()) as Record<string, unknown>;
  const sb = crmClient();
  const orgId = await getOrgId();

  if (!(await verifyRateOwnership(sb, id, rateId, orgId))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const allowed: Record<string, unknown> = {};
  for (const k of ["kind", "label", "base_rate", "min_charge", "unit", "conditions_json"]) {
    if (k in body) allowed[k] = body[k];
  }

  const { data, error } = await sb.from("tariff_rates").update(allowed).eq("id", rateId).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rate: data });
}

/** DELETE /api/tariffs/[id]/rates/[rateId] — hard-delete (cascades to tiers). */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; rateId: string }> },
) {
  const { id, rateId } = await params;
  const sb = crmClient();
  const orgId = await getOrgId();

  if (!(await verifyRateOwnership(sb, id, rateId, orgId))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const { error } = await sb.from("tariff_rates").delete().eq("id", rateId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
