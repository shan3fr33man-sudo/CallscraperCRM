import { NextResponse } from "next/server";
import { crmClient } from "@/lib/crmdb";
import { requireOrgId } from "@/lib/auth";
import { resolveTariff } from "@callscrapercrm/pricing";

export const runtime = "nodejs";

/**
 * GET /api/tariffs/resolve?branch_id=...&service_type=...&opportunity_type=...
 *
 * Runs the pricing engine's `resolveTariff()` against every non-archived
 * tariff assignment in the org and returns which tariff would apply for
 * the given (branch, service_type, opportunity_type) context.
 *
 * Powers the live "Winner" preview on the tariff library editor (F6). Pure
 * read-only; no writes. Returns `{ tariff_id: null }` when no assignment
 * matches so callers can show a neutral "No match" state.
 *
 * Cross-tenant scoping strategy (defensive, belt-and-suspenders):
 *   `tariff_assignments` has no `org_id` column of its own; it's scoped
 *   via the FK to `tariffs`. Rather than trusting a PostgREST embedded
 *   join filter (which varies by client version and RLS posture), we
 *   first pull the current org's non-archived tariff ids into a list,
 *   then query `tariff_assignments` restricted to that list. Two round-
 *   trips, zero chance of cross-tenant leakage even with a service-role
 *   client that bypasses RLS.
 */
export async function GET(req: Request) {
  let orgId: string;
  try { orgId = await requireOrgId(); }
  catch (res) { if (res instanceof Response) return res; throw res; }
  const url = new URL(req.url);
  const branchId = url.searchParams.get("branch_id") || undefined;
  const serviceType = url.searchParams.get("service_type") || undefined;
  const opportunityType = url.searchParams.get("opportunity_type") || undefined;

  const sb = crmClient();

  // Step 1: fetch this org's non-archived tariffs (id + name). This is the
  // ONLY gate between the caller and another tenant's data.
  const { data: tariffs, error: tErr } = await sb
    .from("tariffs")
    .select("id,name")
    .eq("org_id", orgId)
    .eq("archived", false);
  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });
  if (!tariffs || tariffs.length === 0) {
    return NextResponse.json({ tariff_id: null, tariff_name: null });
  }
  const tariffIds = tariffs.map((t) => t.id);
  const tariffNameById = new Map<string, string>(tariffs.map((t) => [t.id, t.name]));

  // Step 2: fetch assignments for those tariff ids. Even if a caller
  // somehow injected a tariff_id from another org, the `.in()` guards it.
  const { data: rows, error: aErr } = await sb
    .from("tariff_assignments")
    .select("id,tariff_id,branch_id,service_type,opportunity_type,priority")
    .in("tariff_id", tariffIds);
  if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 });

  const assignments = (rows ?? []).map((row) => ({
    id: row.id as string,
    tariff_id: row.tariff_id as string,
    branch_id: (row.branch_id as string | null) ?? null,
    service_type: (row.service_type as string | null) ?? null,
    opportunity_type: (row.opportunity_type as string | null) ?? null,
    priority: Number(row.priority ?? 0),
  }));

  const winnerId = resolveTariff(assignments, {
    branch_id: branchId,
    service_type: serviceType,
    opportunity_type: opportunityType,
  });

  if (!winnerId) {
    return NextResponse.json({ tariff_id: null, tariff_name: null });
  }

  // Winner's name comes from the Map we built above (no extra round-trip,
  // and it's guaranteed to be in-org because we seeded from the scoped
  // tariffs query).
  return NextResponse.json({
    tariff_id: winnerId,
    tariff_name: tariffNameById.get(winnerId) ?? null,
  });
}
