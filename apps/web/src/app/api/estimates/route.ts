import { NextResponse } from "next/server";
import { crmClient } from "@/lib/crmdb";
import { getOrgId } from "@/lib/auth";
import { emitEvent } from "@/lib/river";
import {
  calculateEstimate,
  estimateInputSchema,
  pricingOptionsSchema,
  resolveTariff,
} from "@callscrapercrm/pricing";
import type { FullTariff, EstimateInput, PricingOptions } from "@callscrapercrm/pricing";

export const runtime = "nodejs";

async function loadFullTariff(
  sb: ReturnType<typeof crmClient>,
  tariffId: string,
  orgId: string,
): Promise<FullTariff | null> {
  const [tariffRes, ratesRes, modsRes, valsRes, capsRes, assignsRes] = await Promise.all([
    sb.from("tariffs").select("*").eq("id", tariffId).eq("org_id", orgId).maybeSingle(),
    sb.from("tariff_rates").select("*").eq("tariff_id", tariffId),
    sb.from("tariff_modifiers").select("*").eq("tariff_id", tariffId).order("stacking_order"),
    sb.from("tariff_valuations").select("*").eq("tariff_id", tariffId),
    sb.from("tariff_handicaps").select("*").eq("tariff_id", tariffId),
    sb.from("tariff_assignments").select("*").eq("tariff_id", tariffId),
  ]);
  if (!tariffRes.data) return null;
  const rateIds = (ratesRes.data ?? []).map((r) => r.id);
  let tiers: { id: string; tariff_rate_id: string; threshold: number; rate: number }[] = [];
  if (rateIds.length > 0) {
    const { data: tierRows } = await sb.from("tariff_tiers").select("*").in("tariff_rate_id", rateIds);
    tiers = tierRows ?? [];
  }
  return {
    ...(tariffRes.data as Omit<FullTariff, "rates" | "modifiers" | "valuations" | "handicaps" | "assignments">),
    rates: (ratesRes.data ?? []).map((r) => ({ ...r, tiers: tiers.filter((t) => t.tariff_rate_id === r.id) })) as FullTariff["rates"],
    modifiers: (modsRes.data ?? []) as FullTariff["modifiers"],
    valuations: (valsRes.data ?? []) as FullTariff["valuations"],
    handicaps: (capsRes.data ?? []) as FullTariff["handicaps"],
    assignments: (assignsRes.data ?? []) as FullTariff["assignments"],
  };
}

/** GET /api/estimates — list estimates (filterable by opportunity_id, customer_id, status). */
export async function GET(req: Request) {
  const sb = crmClient();
  const orgId = await getOrgId();
  const { searchParams } = new URL(req.url);
  const opportunityId = searchParams.get("opportunity_id");
  let q = sb.from("estimates").select("*").eq("org_id", orgId);
  if (opportunityId) q = q.eq("opportunity_id", opportunityId);
  const { data, error } = await q.order("created_at", { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ estimates: data ?? [] });
}

/**
 * POST /api/estimates — create an estimate.
 *
 * Two modes:
 *  1. Manual: client provides charges_json/subtotal/amount directly (legacy)
 *  2. Engine: client provides { tariff_id?, estimate_input, options? }
 *     - If tariff_id omitted, we resolve via opportunity context (branch/service_type)
 *     - Engine output → charges_json, subtotal, sales_tax, amount, tariff_snapshot
 */
export async function POST(req: Request) {
  const body = (await req.json()) as Record<string, unknown>;
  const sb = crmClient();
  const orgId = await getOrgId();

  const insert: Record<string, unknown> = {
    org_id: orgId,
    opportunity_id: body.opportunity_id ?? null,
    valid_until: body.valid_until ?? null,
    estimate_type: body.estimate_type ?? "non_binding",
    estimate_number: body.estimate_number ?? null,
    deposit_amount: body.deposit_amount ?? 0,
  };

  // Engine path: we have estimate_input → run pricing engine
  if (body.estimate_input) {
    const inputParsed = estimateInputSchema.safeParse(body.estimate_input);
    if (!inputParsed.success) {
      return NextResponse.json(
        { error: "Invalid estimate_input", details: inputParsed.error.flatten() },
        { status: 400 },
      );
    }
    const optsParsed = pricingOptionsSchema.safeParse(body.options ?? {});
    if (!optsParsed.success) {
      return NextResponse.json(
        { error: "Invalid options", details: optsParsed.error.flatten() },
        { status: 400 },
      );
    }
    const input: EstimateInput = inputParsed.data;
    const options: PricingOptions = optsParsed.data;

    // Resolve tariff
    let tariffId = body.tariff_id as string | undefined;
    if (!tariffId) {
      // Try to derive context from the opportunity
      let branch_id: string | null = null;
      let service_type: string | null = null;
      let opportunity_type: string | null = null;
      if (body.opportunity_id) {
        const { data: opp } = await sb
          .from("opportunities")
          .select("branch_id, service_type, opportunity_type")
          .eq("id", body.opportunity_id)
          .maybeSingle();
        if (opp) {
          branch_id = (opp.branch_id as string | null) ?? null;
          service_type = (opp.service_type as string | null) ?? input.move_type ?? null;
          opportunity_type = (opp.opportunity_type as string | null) ?? null;
        }
      }
      const { data: assigns } = await sb.from("tariff_assignments").select("*");
      tariffId =
        resolveTariff(assigns ?? [], { branch_id, service_type, opportunity_type }) ?? undefined;
      if (!tariffId) {
        // Fall back to default tariff for org
        const { data: defaultT } = await sb
          .from("tariffs")
          .select("id")
          .eq("org_id", orgId)
          .eq("is_default", true)
          .eq("archived", false)
          .maybeSingle();
        tariffId = defaultT?.id;
      }
    }

    if (!tariffId) {
      return NextResponse.json({ error: "No tariff resolvable. Pass tariff_id explicitly." }, { status: 400 });
    }

    const fullTariff = await loadFullTariff(sb, tariffId, orgId);
    if (!fullTariff) {
      return NextResponse.json({ error: "Tariff not found" }, { status: 404 });
    }

    const result = calculateEstimate(fullTariff, input, options);
    insert.tariff_id = tariffId;
    insert.charges_json = result.line_items;
    insert.subtotal = result.subtotal;
    insert.discounts = result.discount;
    insert.sales_tax = result.sales_tax;
    insert.amount = result.total;
    insert.tariff_snapshot = result.tariff_snapshot;
  } else {
    // Manual path (backward compatible)
    insert.charges_json = body.charges_json ?? [];
    insert.subtotal = body.subtotal ?? 0;
    insert.discounts = body.discounts ?? 0;
    insert.sales_tax = body.sales_tax ?? 0;
    insert.amount = body.amount ?? body.estimated_total ?? 0;
    if (body.tariff_id) insert.tariff_id = body.tariff_id;
  }

  const { data, error } = await sb.from("estimates").insert(insert).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await emitEvent(sb, {
    org_id: orgId,
    type: "estimate.created",
    related_type: "estimate",
    related_id: data.id,
    payload: { estimate_id: data.id, opportunity_id: data.opportunity_id, amount: data.amount },
  });

  return NextResponse.json({ estimate: data });
}
