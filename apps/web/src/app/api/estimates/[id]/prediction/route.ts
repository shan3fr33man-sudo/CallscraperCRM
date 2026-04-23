import { NextResponse } from "next/server";
import { crmClient } from "@/lib/crmdb";
import { requireOrgId } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * GET /api/estimates/:id/prediction
 *
 * Returns the estimator_predictions row tied to an estimate, if one exists.
 * Used by the "why these numbers?" popover on the EstimateTab so agents can
 * audit auto-generated estimates without hitting the DB directly.
 *
 * Only estimates with `auto_generated=true` will have a prediction row.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let orgId: string;
  try { orgId = await requireOrgId(); }
  catch (res) { if (res instanceof Response) return res; throw res; }
  const { id } = await params;
  const sb = crmClient();

  const { data, error } = await sb
    .from("estimator_predictions")
    .select(
      "id, brand_code, pricing_mode, comparable_sample_n, confidence, margin_status, margin_pct, driveway_review_required, driveway_flags, deadhead_skipped, prediction_json, created_at",
    )
    .eq("estimate_id", id)
    .eq("org_id", orgId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ prediction: null });

  // Narrow prediction_json to just the shape the popover renders.
  type PredictionPayload = {
    explanation?: string[];
    estimate_input?: Record<string, unknown>;
    materials?: Array<{ sku: string; qty: number; unit_price?: number }>;
    valuation?: { recommended: string; declared_value?: number };
    inventory_totals?: {
      total_cu_ft?: number;
      total_weight_lb?: number;
      specialty_items?: string[];
      oversized_tvs?: string[];
    };
  };
  const p = (data.prediction_json ?? {}) as PredictionPayload;

  return NextResponse.json({
    prediction: {
      id: data.id,
      brand_code: data.brand_code,
      pricing_mode: data.pricing_mode,
      comparable_sample_n: data.comparable_sample_n,
      confidence: data.confidence,
      margin_status: data.margin_status,
      margin_pct: data.margin_pct,
      driveway_review_required: data.driveway_review_required,
      driveway_flags: data.driveway_flags,
      deadhead_skipped: data.deadhead_skipped,
      created_at: data.created_at,
      explanation: p.explanation ?? [],
      estimate_input: p.estimate_input ?? {},
      materials: p.materials ?? [],
      valuation: p.valuation ?? null,
      inventory_totals: p.inventory_totals ?? null,
    },
  });
}
