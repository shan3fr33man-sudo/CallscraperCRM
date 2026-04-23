import { NextResponse } from "next/server";
import { crmClient } from "@/lib/crmdb";
import { requireOrgId } from "@/lib/auth";
import { parseBody } from "@/lib/validate";
import { createTierSchema } from "@callscrapercrm/pricing";

export const runtime = "nodejs";

async function verifyOwnership(
  sb: ReturnType<typeof crmClient>,
  rateId: string,
  orgId: string,
): Promise<boolean> {
  const { data } = await sb
    .from("tariff_rates")
    .select("id, tariffs!inner(org_id)")
    .eq("id", rateId)
    .maybeSingle();
  if (!data) return false;
  const joined = (data as unknown as { tariffs: { org_id: string } | { org_id: string }[] }).tariffs;
  const orgFromJoin = Array.isArray(joined) ? joined[0]?.org_id : joined?.org_id;
  return orgFromJoin === orgId;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; rateId: string }> },
) {
  let orgId: string;
  try { orgId = await requireOrgId(); }
  catch (res) { if (res instanceof Response) return res; throw res; }
  const { rateId } = await params;
  const sb = crmClient();
  if (!(await verifyOwnership(sb, rateId, orgId))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const { data, error } = await sb
    .from("tariff_tiers")
    .select("*")
    .eq("tariff_rate_id", rateId)
    .order("threshold");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tiers: data ?? [] });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; rateId: string }> },
) {
  let orgId: string;
  try { orgId = await requireOrgId(); }
  catch (res) { if (res instanceof Response) return res; throw res; }
  const { rateId } = await params;
  const body = await parseBody(req, createTierSchema);
  if (body instanceof Response) return body;

  const sb = crmClient();
  if (!(await verifyOwnership(sb, rateId, orgId))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const { data, error } = await sb
    .from("tariff_tiers")
    .insert({ tariff_rate_id: rateId, ...body })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tier: data });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; rateId: string }> },
) {
  let orgId: string;
  try { orgId = await requireOrgId(); }
  catch (res) { if (res instanceof Response) return res; throw res; }
  const { rateId } = await params;
  const { searchParams } = new URL(req.url);
  const tierId = searchParams.get("tier_id");
  if (!tierId) return NextResponse.json({ error: "tier_id required" }, { status: 400 });
  const sb = crmClient();
  if (!(await verifyOwnership(sb, rateId, orgId))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const { error } = await sb.from("tariff_tiers").delete().eq("id", tierId).eq("tariff_rate_id", rateId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
