import { NextResponse } from "next/server";
import { crmClient } from "@/lib/crmdb";
import { getOrgId } from "@/lib/auth";

export const runtime = "nodejs";

/** GET /api/tariffs — list tariffs (filterable by branch_id, service_type, archived). */
export async function GET(req: Request) {
  const sb = crmClient();
  const orgId = await getOrgId();
  const { searchParams } = new URL(req.url);
  const branchId = searchParams.get("branch_id");
  const serviceType = searchParams.get("service_type");
  const includeArchived = searchParams.get("archived") === "true";

  let q = sb.from("tariffs").select("*").eq("org_id", orgId);
  if (branchId) q = q.eq("branch_id", branchId);
  if (serviceType) q = q.eq("service_type", serviceType);
  if (!includeArchived) q = q.eq("archived", false);

  const { data, error } = await q.order("is_default", { ascending: false }).order("name", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Compute rate counts inline for the list view
  const ids = (data ?? []).map((t) => t.id);
  let rateCounts: Record<string, number> = {};
  if (ids.length > 0) {
    const { data: rates } = await sb.from("tariff_rates").select("tariff_id").in("tariff_id", ids);
    rateCounts = (rates ?? []).reduce((acc: Record<string, number>, r) => {
      acc[r.tariff_id] = (acc[r.tariff_id] ?? 0) + 1;
      return acc;
    }, {});
  }
  const tariffs = (data ?? []).map((t) => ({ ...t, rate_count: rateCounts[t.id] ?? 0 }));
  return NextResponse.json({ tariffs });
}

/** POST /api/tariffs — create a new tariff. */
export async function POST(req: Request) {
  const body = (await req.json()) as Record<string, unknown>;
  const sb = crmClient();
  const orgId = await getOrgId();

  const { data, error } = await sb
    .from("tariffs")
    .insert({
      org_id: orgId,
      name: body.name ?? "New Tariff",
      branch_id: body.branch_id ?? null,
      service_type: body.service_type ?? null,
      effective_from: body.effective_from ?? null,
      effective_to: body.effective_to ?? null,
      currency: body.currency ?? "USD",
      rounding_rule: body.rounding_rule ?? "nearest_cent",
      is_default: body.is_default ?? false,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tariff: data });
}
