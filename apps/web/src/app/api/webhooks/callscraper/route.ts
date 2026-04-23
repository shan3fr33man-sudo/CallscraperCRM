import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { crmClient } from "@/lib/crmdb";
import { emitEvent } from "@/lib/river";
import { createSupabaseEstimatorDataSource } from "@/lib/estimator/data-source";
import {
  extractInventoryFromTranscript,
  predictEstimateInputs,
  type InventoryItem,
  type MoveCategory,
  type PredictionResult,
} from "@callscrapercrm/estimator";

/**
 * POST /api/webhooks/callscraper
 *
 * Receives post-processed call payloads. Two valid producers today:
 *
 *  1. The worker subscriber (apps/worker/src/jobs/callscraper-subscriber.ts),
 *     which listens to Supabase realtime INSERTs on the CallScraper v3
 *     project's `call_summaries` table, joins with `calls`, normalizes to
 *     the shape below, HMAC-signs, and POSTs here.
 *  2. (Optional, future) An outbound webhook fired directly by CallScraper
 *     v3 if the team builds one. Same payload shape; same signature.
 *
 * Tenant model: one `organizations` row (default), four `branches` rows by
 * `brand_code` ∈ APM | AFM | crewready | apex. `payload.company` maps to
 * `branches.brand_code`; the webhook resolves (org_id, brand_code) from it
 * and every downstream write carries `brand_code` for per-brand statistics.
 *
 * At-least-once delivery is expected. Idempotency keys off `sessionId`
 * (RingCentral) stored on `estimator_predictions.source_call_id` and on
 * `opportunities.source_call_id` (unique indexes from migration 0013).
 * Upserts use `onConflict` to avoid read-then-insert races.
 */

export const runtime = "nodejs";

interface CallScraperPayload {
  event: "call.completed" | "call.ended";
  source?: "subscriber" | "webhook" | string;

  /** RingCentral sessionId — stable per call, used for idempotency. */
  sessionId: string;
  /** `branches.brand_code` — e.g., APM (A Perfect Mover), AFM (Affordable Movers LLC). */
  company?: "APM" | "AFM" | "crewready" | "apex" | string;
  extensionId?: string;
  direction?: "inbound" | "outbound";
  agentName?: string;
  startedAt?: string;
  endedAt?: string;

  caller: {
    phone: string;
    phoneDisplay?: string;
    name?: string;
    rcName?: string;
    email?: string;
  };

  sm?: {
    found?: boolean;
    smType?: "customer" | "lead" | "unknown" | string;
    customerId?: string;
    opportunityId?: string;
    latestQuoteNumber?: number;
    latestQuoteAmount?: number;
    latestQuoteUrl?: string;
  };

  addresses?: {
    originAddress?: string;
    originLat?: number;
    originLng?: number;
    originStreetViewUrl?: string;
    destinationAddress?: string;
    destinationLat?: number;
    destinationLng?: number;
    destinationStreetViewUrl?: string;
  };

  summary?: {
    intent?: string;
    text?: string;
    crewEstimate?: string | number;
    truckEstimate?: string;
    tags?: string[];
    callOutcome?: string;
    moveSize?: string;
    moveDate?: string;
    transcript?: string;
  };

  callTags?: string[];
  callCount?: number;
  customerSummary?: string;
  lastCallSummary?: string;
}

export async function POST(req: Request) {
  const secret = process.env.CALLSCRAPER_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "webhook secret not configured" }, { status: 500 });
  }

  const rawBody = await req.text();
  const sig = req.headers.get("x-callscraper-signature") ?? "";
  if (!verifySignature(rawBody, sig, secret)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let payload: CallScraperPayload;
  try {
    payload = JSON.parse(rawBody) as CallScraperPayload;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (payload.event !== "call.completed" && payload.event !== "call.ended") {
    return NextResponse.json({ ok: true, skipped: payload.event });
  }
  if (!payload.sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  const sb = crmClient();
  const resolved = await resolveBrand(sb, payload);
  if (!resolved) {
    return NextResponse.json({ error: "could not resolve brand" }, { status: 404 });
  }
  const { orgId, brandCode } = resolved;

  // Idempotency: already processed this sessionId + brand → return prior record.
  {
    const { data: prior } = await sb
      .from("estimator_predictions")
      .select("id, estimate_id, opportunity_id, margin_status")
      .eq("org_id", orgId)
      .eq("brand_code", brandCode)
      .eq("source_call_id", payload.sessionId)
      .maybeSingle();
    if (prior) {
      return NextResponse.json({
        ok: true,
        idempotent: true,
        opportunity_id: prior.opportunity_id,
        estimate_id: prior.estimate_id,
      });
    }
  }

  const customerId = await upsertCustomer(sb, orgId, payload.caller);
  const opportunityId = await upsertOpportunity(sb, orgId, brandCode, customerId, payload);

  const transcriptText = payload.summary?.transcript ?? payload.summary?.text ?? "";
  const inventory = await extractAndCacheInventory(
    sb,
    opportunityId,
    transcriptText,
    payload.summary?.intent,
  );

  const ds = createSupabaseEstimatorDataSource({
    sb,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
  });
  const moveCategory = normalizeCategory(payload.summary?.moveSize);
  const prediction = await predictEstimateInputs(
    {
      orgId,
      brandCode,
      moveCategory,
      originAddress: payload.addresses?.originAddress,
      destAddress: payload.addresses?.destinationAddress,
      serviceDate: payload.summary?.moveDate ?? new Date().toISOString().slice(0, 10),
      inventory,
    },
    ds,
  );

  const isBlocked = prediction.margin.status === "block";
  const estimate = await writeEstimate(sb, orgId, opportunityId, prediction);

  // Sum of extra_line_items is the stable "predicted subtotal" the feedback
  // trigger (0015) will use to compute drift once the agent sends.
  const predictedAmount = prediction.extra_line_items.reduce((s, l) => s + l.total, 0);

  // Prediction log; on 23505 (concurrent duplicate delivery) re-read the prior row.
  const { error: predError } = await sb.from("estimator_predictions").insert({
    org_id: orgId,
    brand_code: brandCode,
    estimate_id: estimate?.id ?? null,
    opportunity_id: opportunityId,
    source_call_id: payload.sessionId,
    pricing_mode: prediction.pricing_mode,
    inputs_json: payload,
    prediction_json: prediction,
    predicted_amount: Math.round(predictedAmount * 100) / 100,
    comparable_sample_n: prediction.comparable_sample_n,
    confidence: prediction.confidence,
    margin_status: prediction.margin.status,
    margin_pct: prediction.margin.gross_margin_pct,
    driveway_review_required: prediction.driveway_review_required,
    driveway_flags: prediction.driveway_flags,
    deadhead_skipped: prediction.deadhead_skipped,
  });
  if (predError && (predError as { code?: string }).code === "23505") {
    const { data: prior } = await sb
      .from("estimator_predictions")
      .select("id, estimate_id, opportunity_id, margin_status")
      .eq("org_id", orgId)
      .eq("brand_code", brandCode)
      .eq("source_call_id", payload.sessionId)
      .maybeSingle();
    if (prior) {
      return NextResponse.json({
        ok: true,
        idempotent: true,
        opportunity_id: prior.opportunity_id,
        estimate_id: prior.estimate_id,
      });
    }
  }

  if (!isBlocked && estimate) {
    await emitEvent(sb, {
      org_id: orgId,
      type: "estimate.auto_generated",
      related_type: "estimate",
      related_id: estimate.id,
      payload: {
        estimate_id: estimate.id,
        opportunity_id: opportunityId,
        amount: estimate.amount,
        pricing_mode: prediction.pricing_mode,
        confidence: prediction.confidence,
        driveway_review_required: prediction.driveway_review_required,
        margin_status: prediction.margin.status,
        source_call_id: payload.sessionId,
        brand_code: brandCode,
      },
    });
  }

  return NextResponse.json({
    ok: true,
    brand_code: brandCode,
    customer_id: customerId,
    opportunity_id: opportunityId,
    estimate_id: estimate?.id ?? null,
    margin_status: prediction.margin.status,
    auto_generated: !isBlocked,
  });
}

function verifySignature(body: string, providedHex: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(body).digest();
  let provided: Buffer;
  try {
    provided = Buffer.from(providedHex, "hex");
  } catch {
    return false;
  }
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(expected, provided);
}

/**
 * Resolve `payload.company` → (org_id, brand_code) via the `branches` table.
 * Falls back to the default branch if the payload has no company tag.
 */
async function resolveBrand(
  sb: ReturnType<typeof crmClient>,
  payload: CallScraperPayload,
): Promise<{ orgId: string; brandCode: string } | null> {
  const code = (payload.company ?? "").trim();
  if (code) {
    // Case-insensitive match; CallScraper sometimes sends "apm" / "Apex" /
    // "APM" depending on source. Our seeds use uppercase canonical forms.
    const { data } = await sb
      .from("branches")
      .select("org_id, brand_code")
      .ilike("brand_code", code)
      .maybeSingle();
    if (data) return { orgId: data.org_id, brandCode: data.brand_code };
  }
  const { data: def } = await sb
    .from("branches")
    .select("org_id, brand_code")
    .eq("is_default", true)
    .limit(1)
    .maybeSingle();
  if (def) return { orgId: def.org_id, brandCode: def.brand_code };
  return null;
}

async function upsertCustomer(
  sb: ReturnType<typeof crmClient>,
  orgId: string,
  caller: CallScraperPayload["caller"],
): Promise<string> {
  // Atomic upsert: the unique index on (org_id, customer_phone WHERE phone!='')
  // from migration 0004 makes this race-safe. `onConflict` uses the column
  // list, not the index name; the partial-index constraint still matches.
  const name =
    caller.name?.trim() || caller.rcName?.trim() || caller.phoneDisplay?.trim() || null;
  const { data, error } = await sb
    .from("customers")
    .upsert(
      {
        org_id: orgId,
        customer_name: name,
        customer_email: caller.email ?? null,
        customer_phone: caller.phone,
        source: "callscraper",
        status: "new",
      },
      { onConflict: "org_id,customer_phone", ignoreDuplicates: false },
    )
    .select("id")
    .single();
  if (error || !data) throw new Error(`upsertCustomer failed: ${error?.message}`);
  return data.id;
}

async function upsertOpportunity(
  sb: ReturnType<typeof crmClient>,
  orgId: string,
  brandCode: string,
  customerId: string,
  payload: CallScraperPayload,
): Promise<string> {
  // Atomic upsert keyed on (org_id, brand_code, source_call_id) — unique
  // index added in migration 0013.
  const origin = payload.addresses?.originAddress;
  const dest = payload.addresses?.destinationAddress;
  const { data: row, error } = await sb
    .from("opportunities")
    .upsert(
      {
        org_id: orgId,
        brand_code: brandCode,
        customer_id: customerId,
        service_type: "moving",
        service_date: payload.summary?.moveDate ?? null,
        move_type: "local",
        move_size: payload.summary?.moveSize ?? null,
        // `opportunities.origin_json` / `destination_json` are jsonb — never
        // `origin_address` columns (those don't exist; migration 0002).
        origin_json: origin ? { address: origin } : null,
        destination_json: dest ? { address: dest } : null,
        sm_id: payload.sm?.opportunityId ?? null,
        source_call_id: payload.sessionId,
      },
      { onConflict: "org_id,brand_code,source_call_id" },
    )
    .select("id")
    .single();
  if (error || !row) throw new Error(`upsertOpportunity failed: ${error?.message}`);
  return row.id;
}

async function extractAndCacheInventory(
  sb: ReturnType<typeof crmClient>,
  opportunityId: string,
  transcriptOrSummary: string,
  intent?: string,
): Promise<InventoryItem[] | undefined> {
  if (!transcriptOrSummary.trim()) return undefined;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return undefined;
  const { data: existing } = await sb
    .from("opportunities")
    .select("extracted_inventory_json")
    .eq("id", opportunityId)
    .maybeSingle();
  if (existing?.extracted_inventory_json) return existing.extracted_inventory_json as InventoryItem[];

  try {
    const result = await extractInventoryFromTranscript({
      transcript: transcriptOrSummary,
      summary: intent,
      apiKey,
    });
    await sb
      .from("opportunities")
      .update({
        extracted_inventory_json: result.items,
        inventory_extracted_at: new Date().toISOString(),
        inventory_extraction_confidence: result.confidence,
      })
      .eq("id", opportunityId);
    return result.items;
  } catch {
    return undefined;
  }
}

function normalizeCategory(size?: string): MoveCategory {
  const v = (size ?? "").toLowerCase().replace(/\s+/g, "");
  if (v.includes("1br") || v.includes("onebed") || v.includes("1bed")) return "1br";
  if (v.includes("2br") || v.includes("twobed") || v.includes("2bed")) return "2br";
  if (v.includes("3br") || v.includes("threebed") || v.includes("3bed")) return "3br";
  if (v.includes("condo")) return "condo";
  if (v.includes("town")) return "townhouse";
  if (v.includes("commer")) return "commercial";
  if (v.includes("single") || v.includes("item")) return "single_item";
  return "apartment";
}

/**
 * Sales tax default. WA taxes MATERIALS + STORAGE but not household-goods
 * transportation services per WAC 458-20-118. We apply tax only to the
 * `material` kind here, matching the legal treatment. Rate is a single flat
 * percent for v1 — move to `estimator_branch_config.sales_tax_pct` once
 * per-brand tuning is needed.
 */
const DEFAULT_SALES_TAX_PCT = 0.09;

async function writeEstimate(
  sb: ReturnType<typeof crmClient>,
  orgId: string,
  opportunityId: string,
  prediction: PredictionResult,
): Promise<{ id: string; amount: number } | null> {
  const subtotal = prediction.extra_line_items.reduce((s, l) => s + l.total, 0);
  const taxableSubtotal = prediction.extra_line_items
    .filter((l) => l.kind === "material")
    .reduce((s, l) => s + l.total, 0);
  const salesTax = Math.round(taxableSubtotal * DEFAULT_SALES_TAX_PCT * 100) / 100;
  const amount = Math.round((subtotal + salesTax) * 100) / 100;

  const { data, error } = await sb
    .from("estimates")
    .insert({
      org_id: orgId,
      opportunity_id: opportunityId,
      charges_json: prediction.extra_line_items,
      subtotal: Math.round(subtotal * 100) / 100,
      sales_tax: salesTax,
      amount,
      estimate_type: prediction.estimate_type,
      auto_generated: true,
      pricing_mode: prediction.pricing_mode,
    })
    .select("id, amount")
    .single();
  if (error || !data) {
    console.error("writeEstimate failed:", error?.message);
    return null;
  }
  return data;
}
