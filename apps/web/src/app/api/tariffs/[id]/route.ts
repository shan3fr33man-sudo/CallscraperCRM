import { NextResponse } from "next/server";
import { crmClient } from "@/lib/crmdb";
import { requireOrgId } from "@/lib/auth";
import { parseBody, stripUndefined } from "@/lib/validate";
import { updateTariffSchema } from "@callscrapercrm/pricing";

export const runtime = "nodejs";

/** GET /api/tariffs/[id] — return tariff with all children eager-loaded. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  let orgId: string;
  try { orgId = await requireOrgId(); }
  catch (res) { if (res instanceof Response) return res; throw res; }
  const { id } = await params;
  const sb = crmClient();

  const [tariffRes, ratesRes, modsRes, valsRes, capsRes, assignsRes] = await Promise.all([
    sb.from("tariffs").select("*").eq("id", id).eq("org_id", orgId).maybeSingle(),
    sb.from("tariff_rates").select("*").eq("tariff_id", id),
    sb.from("tariff_modifiers").select("*").eq("tariff_id", id).order("stacking_order"),
    sb.from("tariff_valuations").select("*").eq("tariff_id", id),
    sb.from("tariff_handicaps").select("*").eq("tariff_id", id),
    sb.from("tariff_assignments").select("*").eq("tariff_id", id).order("priority", { ascending: false }),
  ]);

  if (tariffRes.error || !tariffRes.data) {
    return NextResponse.json({ error: tariffRes.error?.message ?? "not found" }, { status: 404 });
  }

  // Load tiers for each rate
  const rateIds = (ratesRes.data ?? []).map((r) => r.id);
  let tiers: Array<{ id: string; tariff_rate_id: string; threshold: number; rate: number }> = [];
  if (rateIds.length > 0) {
    const { data: tierRows } = await sb
      .from("tariff_tiers")
      .select("*")
      .in("tariff_rate_id", rateIds)
      .order("threshold", { ascending: true });
    tiers = tierRows ?? [];
  }
  const ratesWithTiers = (ratesRes.data ?? []).map((r) => ({
    ...r,
    tiers: tiers.filter((t) => t.tariff_rate_id === r.id),
  }));

  return NextResponse.json({
    tariff: {
      ...tariffRes.data,
      rates: ratesWithTiers,
      modifiers: modsRes.data ?? [],
      valuations: valsRes.data ?? [],
      handicaps: capsRes.data ?? [],
      assignments: assignsRes.data ?? [],
    },
  });
}

/** PATCH /api/tariffs/[id] — update tariff metadata. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let orgId: string;
  try { orgId = await requireOrgId(); }
  catch (res) { if (res instanceof Response) return res; throw res; }
  const { id } = await params;
  const body = await parseBody(req, updateTariffSchema);
  if (body instanceof Response) return body;

  const sb = crmClient();

  // Branch ownership check if being reassigned
  if (body.branch_id) {
    const { data: branch } = await sb
      .from("branches")
      .select("id")
      .eq("id", body.branch_id)
      .eq("org_id", orgId)
      .maybeSingle();
    if (!branch) {
      return NextResponse.json({ error: "branch_id does not exist in this org" }, { status: 404 });
    }
  }

  // Strip undefined so omitted fields aren't written as null
  const patch = stripUndefined(body as Record<string, unknown>);
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data, error } = await sb
    .from("tariffs")
    .update(patch)
    .eq("id", id)
    .eq("org_id", orgId)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tariff: data });
}

/** DELETE /api/tariffs/[id] — soft-archive (we never hard-delete tariffs). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  let orgId: string;
  try { orgId = await requireOrgId(); }
  catch (res) { if (res instanceof Response) return res; throw res; }
  const { id } = await params;
  const sb = crmClient();
  const { error } = await sb.from("tariffs").update({ archived: true }).eq("id", id).eq("org_id", orgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
