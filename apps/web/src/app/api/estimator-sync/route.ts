import { NextResponse } from "next/server";
import { crmClient } from "@/lib/crmdb";
import { requireOrgId } from "@/lib/auth";

export const runtime = "nodejs";

/** Current sync progress per category + totals per analytics table. */
export async function GET() {
  let orgId: string;
  try { orgId = await requireOrgId(); }
  catch (res) { if (res instanceof Response) return res; throw res; }
  const sb = crmClient();

  const [cursors, historical, stats, materials, valuations, predictions] = await Promise.all([
    sb.from("sm_sync_cursor").select("*").eq("org_id", orgId),
    sb.from("historical_jobs").select("move_category", { count: "exact", head: false }).eq("org_id", orgId),
    sb.from("move_size_stats").select("id", { count: "exact", head: true }).eq("org_id", orgId),
    sb.from("material_patterns").select("id", { count: "exact", head: true }).eq("org_id", orgId),
    sb.from("valuation_patterns").select("id", { count: "exact", head: true }).eq("org_id", orgId),
    sb
      .from("estimator_predictions")
      .select("id, confidence, margin_status, pricing_mode, created_at", { count: "exact" })
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  // Aggregate historical counts by category in-JS (small result set).
  const byCategory: Record<string, number> = {};
  for (const row of historical.data ?? []) byCategory[row.move_category] = (byCategory[row.move_category] ?? 0) + 1;

  return NextResponse.json({
    cursors: cursors.data ?? [],
    historical_by_category: byCategory,
    totals: {
      move_size_stats: stats.count ?? 0,
      material_patterns: materials.count ?? 0,
      valuation_patterns: valuations.count ?? 0,
      predictions: predictions.count ?? 0,
    },
    recent_predictions: predictions.data ?? [],
  });
}

/** Trigger an aggregation refresh (recomputes move_size_stats, etc.). */
export async function POST() {
  let orgId: string;
  try { orgId = await requireOrgId(); }
  catch (res) { if (res instanceof Response) return res; throw res; }
  const sb = crmClient();
  const { error } = await sb.rpc("refresh_estimator_stats", { p_org_id: orgId });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
