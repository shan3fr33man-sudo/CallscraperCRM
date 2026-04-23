import { NextResponse } from "next/server";
import { crmClient } from "@/lib/crmdb";
import { requireOrgId } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * GET /api/estimator-accuracy
 *
 * Returns aggregate drift stats for auto-generated estimates that have been
 * sent. Every row in the underlying query has a `final_amount` (written by
 * the DB trigger from 0015), so `amount_delta_pct` is signed: positive means
 * the agent charged more than the estimator predicted (we under-priced),
 * negative means they cut the price to close (we over-priced).
 *
 * Shape:
 *   {
 *     overall: { n, mean_delta_pct, median_delta_pct, within_15_pct_rate, edited_pct },
 *     buckets: [ { brand_code, move_category, pricing_mode, n, mean_delta_pct, ... } ],
 *     recent: [ { ...prediction, estimate summary } ]   // last 20
 *   }
 */

type Row = {
  id: string;
  brand_code: string;
  pricing_mode: "local" | "long_distance";
  predicted_amount: number | null;
  final_amount: number | null;
  amount_delta_pct: number | null;
  edited_by_agent: boolean | null;
  confidence: number | null;
  margin_status: string | null;
  final_captured_at: string | null;
  inputs_json: Record<string, unknown> | null;
};

export async function GET() {
  let orgId: string;
  try { orgId = await requireOrgId(); }
  catch (res) { if (res instanceof Response) return res; throw res; }
  const sb = crmClient();

  // Cap at 90 days of feedback — enough for meaningful drift stats, bounded
  // so page load stays fast as the estimator matures. The `LIMIT` is a
  // defensive ceiling; under normal volumes the date filter does the work.
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const ROW_CAP = 500;
  const { data, error } = await sb
    .from("estimator_predictions")
    .select(
      "id, brand_code, pricing_mode, predicted_amount, final_amount, amount_delta_pct, edited_by_agent, confidence, margin_status, final_captured_at, inputs_json",
    )
    .eq("org_id", orgId)
    .not("final_amount", "is", null)
    .gte("final_captured_at", ninetyDaysAgo)
    .order("final_captured_at", { ascending: false })
    .limit(ROW_CAP);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = (data ?? []) as Row[];

  // Flag truncation so the frontend / ops can tell if the 500-row cap was
  // hit (in which case statistics are biased toward recent deliveries).
  const truncated = rows.length === ROW_CAP;

  const overall = summarize(rows);
  const recent = rows.slice(0, 20).map((r) => ({
    id: r.id,
    brand_code: r.brand_code,
    pricing_mode: r.pricing_mode,
    predicted_amount: r.predicted_amount,
    final_amount: r.final_amount,
    amount_delta_pct: r.amount_delta_pct,
    edited_by_agent: r.edited_by_agent,
    confidence: r.confidence,
    margin_status: r.margin_status,
    final_captured_at: r.final_captured_at,
    move_size: extractMoveSize(r.inputs_json),
  }));

  // Bucket by brand × move_category × pricing_mode.
  const buckets = new Map<string, Row[]>();
  for (const r of rows) {
    const category = extractMoveSize(r.inputs_json) ?? "unknown";
    const key = `${r.brand_code}|${category}|${r.pricing_mode}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(r);
  }
  const bucketStats = Array.from(buckets.entries())
    .map(([key, arr]) => {
      const [brand_code, move_category, pricing_mode] = key.split("|");
      return {
        brand_code,
        move_category,
        pricing_mode,
        ...summarize(arr),
      };
    })
    .sort((a, b) => b.n - a.n);

  return NextResponse.json({
    overall,
    buckets: bucketStats,
    recent,
    truncated,
    window_days: 90,
  });
}

function summarize(arr: Row[]) {
  if (arr.length === 0) {
    return {
      n: 0,
      mean_delta_pct: 0,
      median_delta_pct: 0,
      within_15_pct_rate: 0,
      edited_pct: 0,
    };
  }
  const deltas = arr
    .map((r) => (typeof r.amount_delta_pct === "number" ? r.amount_delta_pct : null))
    .filter((v): v is number => v !== null);
  const mean =
    deltas.length === 0 ? 0 : deltas.reduce((s, x) => s + x, 0) / deltas.length;
  const median = deltas.length === 0 ? 0 : percentile(deltas, 0.5);
  const within =
    deltas.length === 0
      ? 0
      : deltas.filter((d) => Math.abs(d) <= 15).length / deltas.length;
  const edited = arr.filter((r) => r.edited_by_agent === true).length / arr.length;
  return {
    n: arr.length,
    mean_delta_pct: Math.round(mean * 10) / 10,
    median_delta_pct: Math.round(median * 10) / 10,
    within_15_pct_rate: Math.round(within * 1000) / 1000,
    edited_pct: Math.round(edited * 1000) / 1000,
  };
}

function percentile(sorted: number[], p: number): number {
  const arr = [...sorted].sort((a, b) => a - b);
  const idx = p * (arr.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return arr[lo];
  return arr[lo] + (arr[hi] - arr[lo]) * (idx - lo);
}

function extractMoveSize(inputs: Record<string, unknown> | null): string | null {
  if (!inputs) return null;
  const summary = (inputs as { summary?: { moveSize?: string } }).summary;
  return summary?.moveSize ?? null;
}
