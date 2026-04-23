import { composeLongDistance } from "./long-distance";
import { checkMargin, type MarginPolicy } from "./margin";
import { computeInventoryTotals } from "./inventory";
import { distanceBucket } from "./distance";
import { seasonForDate } from "./season";
import {
  LONG_DISTANCE_THRESHOLD_MILES,
  lookupLinehaul,
  CONSTRUCTIVE_LB_PER_CU_FT,
  VALUATION,
} from "./tariff-15c";
import { detectBulkyAdditives, bulkyLineItems, totalWeightAdditive } from "./bulky-additives";
import { composeAccessFees } from "./access-fees";
import { hourlyRateForCrew } from "./types";
import type {
  BranchConfig,
  DistanceBucket,
  InventoryItem,
  InventoryTotals,
  LineItem,
  MaterialRecommendation,
  MoveCategory,
  PredictInputs,
  PredictionResult,
  PricingMode,
  Season,
} from "./types";

/**
 * Main entry point. Predicts the inputs for the CRM's existing pricing engine
 * (`calculateEstimate()` in @callscrapercrm/pricing), and adds recommended
 * materials, valuation, and operational line items on the side.
 *
 * Scoped on `(org_id, brand_code)`. All reads go through the injected
 * `EstimatorDataSource`; this module never touches a database directly.
 */

export interface EstimatorDataSource {
  moveSizeStats(args: {
    orgId: string;
    brandCode: string;
    moveCategory: MoveCategory;
    pricingMode: PricingMode;
    distanceBucket: DistanceBucket;
    season: Season;
  }): Promise<MoveSizeStatRow | null>;

  moveSizeStatsWidened(args: {
    orgId: string;
    brandCode: string;
    moveCategory: MoveCategory;
  }): Promise<MoveSizeStatRow | null>;

  materialPatterns(args: {
    orgId: string;
    brandCode: string;
    moveCategory: MoveCategory;
  }): Promise<MaterialPatternRow[]>;

  valuationPatterns(args: {
    orgId: string;
    brandCode: string;
    moveCategory: MoveCategory;
  }): Promise<ValuationPatternRow | null>;

  operationalFee(args: {
    orgId: string;
    brandCode: string;
    feeType: string;
    moveClass: PricingMode;
  }): Promise<number | null>;

  marginPolicy(args: {
    orgId: string;
    brandCode: string;
    moveClass: PricingMode;
  }): Promise<MarginPolicy>;

  branchConfig(args: { orgId: string; brandCode: string }): Promise<BranchConfig>;

  nearestShopMiles(args: {
    orgId: string;
    brandCode: string;
    originAddress: string;
  }): Promise<number | null>;

  drivingMiles(args: { origin: string; dest: string }): Promise<number | null>;

  drivewayFlags(args: { address: string }): Promise<DrivewayFlags>;
}

export interface MoveSizeStatRow {
  hours_p50: number | null;
  crew_mode: number | null;
  truck_mode: string | null;
  amount_p50: number | null;
  linehaul_rate_median: number | null;
  fuel_surcharge_pct_median: number | null;
  weight_per_cuft_median: number | null;
  sample_n: number;
  distance_bucket: DistanceBucket;
  season: Season;
}

export interface MaterialPatternRow {
  sku: string;
  qty_median: number;
  qty_p75: number;
  unit_price_median: number | null;
  sample_n: number;
}

export interface ValuationPatternRow {
  pct_basic: number;
  pct_full: number;
  avg_declared_value_when_full: number | null;
  sample_n: number;
}

export interface DrivewayFlags {
  narrow: boolean;
  gravel: boolean;
  low_clearance: boolean;
  long_walk: boolean;
}

const CONFIDENT_SAMPLE_THRESHOLD = 30;

/** 15-C Item 10: constructive weight floor. */
const DEFAULT_DENSITY_LB_PER_CU_FT = CONSTRUCTIVE_LB_PER_CU_FT;

export async function predictEstimateInputs(
  inputs: PredictInputs,
  ds: EstimatorDataSource,
): Promise<PredictionResult> {
  const explanation: string[] = [];

  // ── 1. Inventory-derived totals (before any other computation that needs weight). ──
  let inventory_totals: InventoryTotals | undefined;
  if (inputs.inventory && inputs.inventory.length > 0) {
    inventory_totals = computeInventoryTotals(inputs.inventory);
    explanation.push(
      `Inventory parsed: ${inventory_totals.total_cu_ft} cu ft, ~${inventory_totals.total_weight_lb} lb across ${inputs.inventory.length} items.`,
    );
  }

  // Distance — needed for pricing mode + linehaul lookup.
  let total_miles: number | null = null;
  if (inputs.originAddress && inputs.destAddress) {
    total_miles = await ds.drivingMiles({
      origin: inputs.originAddress,
      dest: inputs.destAddress,
    });
    if (total_miles !== null) {
      explanation.push(`Distance: ${Math.round(total_miles)} driving miles.`);
    }
  }

  const crossesState = !!(
    inputs.originState &&
    inputs.destState &&
    inputs.originState !== inputs.destState
  );
  const pricing_mode: PricingMode =
    crossesState || (total_miles !== null && total_miles > LONG_DISTANCE_THRESHOLD_MILES)
      ? "long_distance"
      : "local";
  const estimate_type: "binding" | "non_binding" =
    pricing_mode === "long_distance" ? "binding" : "non_binding";
  explanation.push(
    `Pricing mode: ${pricing_mode} (${crossesState ? "crosses state" : `${Math.round(total_miles ?? 0)} mi`}, 15-C threshold ${LONG_DISTANCE_THRESHOLD_MILES} mi). Estimate type: ${estimate_type}.`,
  );

  const season = seasonForDate(inputs.serviceDate);
  const bucket = distanceBucket(total_miles);

  // ── 2. Parallel reads against the data source (per-brand). ──
  const [stats, materialPatterns, valuationRow, policy, branchCfg] = await Promise.all([
    ds.moveSizeStats({
      orgId: inputs.orgId,
      brandCode: inputs.brandCode,
      moveCategory: inputs.moveCategory,
      pricingMode: pricing_mode,
      distanceBucket: bucket,
      season,
    }),
    ds.materialPatterns({
      orgId: inputs.orgId,
      brandCode: inputs.brandCode,
      moveCategory: inputs.moveCategory,
    }),
    ds.valuationPatterns({
      orgId: inputs.orgId,
      brandCode: inputs.brandCode,
      moveCategory: inputs.moveCategory,
    }),
    ds.marginPolicy({
      orgId: inputs.orgId,
      brandCode: inputs.brandCode,
      moveClass: pricing_mode,
    }),
    ds.branchConfig({ orgId: inputs.orgId, brandCode: inputs.brandCode }),
  ]);

  // Progressive sample widening if the narrow bucket is thin.
  let statsResolved: MoveSizeStatRow | null = stats;
  let confidence = 1.0;
  if (!statsResolved || statsResolved.sample_n < CONFIDENT_SAMPLE_THRESHOLD) {
    const widened = await ds.moveSizeStatsWidened({
      orgId: inputs.orgId,
      brandCode: inputs.brandCode,
      moveCategory: inputs.moveCategory,
    });
    if (widened) {
      statsResolved = widened;
      confidence *= 0.6;
      explanation.push(
        `Narrow-window sample thin (<${CONFIDENT_SAMPLE_THRESHOLD}); widened to any distance/season. Confidence lowered.`,
      );
    } else {
      confidence *= 0.3;
      explanation.push(
        `No historical sample for ${inputs.brandCode}/${inputs.moveCategory}. Using tariff midpoints and branch config.`,
      );
    }
  }

  // ── 3. Derive weight + cu_ft (BEFORE any use downstream; fixes prior TDZ). ──
  const baseline_weight_lb =
    inventory_totals?.total_weight_lb ??
    (inventory_totals?.total_cu_ft
      ? inventory_totals.total_cu_ft * (statsResolved?.weight_per_cuft_median ?? DEFAULT_DENSITY_LB_PER_CU_FT)
      : 0);
  const cu_ft = inventory_totals?.total_cu_ft ?? 0;

  // Tariff 15-C Item 140: bulky-article weight additives inflate the
  // linehaul billable weight. Detect matches against inventory; the returned
  // additive weight adds to linehaul weight, and flat charges become line
  // items further down.
  const bulkyMatches = inputs.inventory ? detectBulkyAdditives(inputs.inventory) : [];
  const bulkyWeightAdditive = totalWeightAdditive(bulkyMatches);
  const weight_lb = baseline_weight_lb + bulkyWeightAdditive;
  if (bulkyWeightAdditive > 0) {
    explanation.push(
      `Bulky additives (15-C Item 140): +${bulkyWeightAdditive} lb for ${bulkyMatches.filter((m) => m.weight_additive_lb > 0).length} items. Billable weight is ${Math.round(weight_lb)} lb.`,
    );
  }

  // ── 4. Materials (always) + valuation recommendation (needs weight_lb). ──
  const materials: MaterialRecommendation[] = materialPatterns
    .filter((m) => m.sample_n >= 5 && m.qty_median > 0)
    .map((m) => ({
      sku: m.sku,
      qty: Math.ceil(m.qty_median),
      unit_price: m.unit_price_median ?? undefined,
      confidence: m.sample_n >= CONFIDENT_SAMPLE_THRESHOLD ? 0.9 : 0.6,
    }));

  const recommendedValuation: "basic" | "full" =
    valuationRow && valuationRow.pct_full > 0.5 ? "full" : "basic";
  const full_declared_floor = Math.round(weight_lb * VALUATION.FULL_VALUE_MULTIPLIER_PER_LB);
  const valuationOut = {
    recommended: recommendedValuation,
    declared_value:
      recommendedValuation === "full"
        ? Math.max(valuationRow?.avg_declared_value_when_full ?? 0, full_declared_floor) ||
          undefined
        : undefined,
    confidence: (valuationRow?.sample_n ?? 0) >= CONFIDENT_SAMPLE_THRESHOLD ? 0.9 : 0.5,
  };

  // ── 5. Line-item composition by pricing mode. ──
  let extra_line_items: LineItem[] = [];
  let estimated_revenue = 0;
  let deadhead_skipped = false;
  let driveway_flags: DrivewayFlags = {
    narrow: false,
    gravel: false,
    low_clearance: false,
    long_walk: false,
  };
  let driveway_review_required = false;

  if (pricing_mode === "long_distance") {
    const tariffRange =
      total_miles && total_miles > LONG_DISTANCE_THRESHOLD_MILES
        ? lookupLinehaul(Math.max(weight_lb, 500), total_miles)
        : null;

    let linehaul_rate: number;
    if (branchCfg.linehaul_rate_mode === "custom" && branchCfg.linehaul_rate_custom_per_lb) {
      linehaul_rate = branchCfg.linehaul_rate_custom_per_lb;
    } else if (tariffRange && statsResolved?.linehaul_rate_median) {
      linehaul_rate = Math.max(
        tariffRange.min_per_lb,
        Math.min(tariffRange.max_per_lb, statsResolved.linehaul_rate_median),
      );
    } else if (tariffRange) {
      linehaul_rate =
        branchCfg.linehaul_rate_mode === "min"
          ? tariffRange.min_per_lb
          : branchCfg.linehaul_rate_mode === "max"
            ? tariffRange.max_per_lb
            : tariffRange.mid_per_lb;
    } else {
      linehaul_rate = statsResolved?.linehaul_rate_median ?? 0.95;
    }
    if (tariffRange) {
      explanation.push(
        `Linehaul: $${linehaul_rate.toFixed(4)}/lb (15-C Item 200, ${tariffRange.distance_row}, ${tariffRange.weight_bracket} bracket; tariff range $${tariffRange.min_per_lb.toFixed(4)}–$${tariffRange.max_per_lb.toFixed(4)}).`,
      );
    }

    const fuel_pct =
      statsResolved?.fuel_surcharge_pct_median ?? branchCfg.default_fuel_surcharge_pct;

    const nearest = inputs.originAddress
      ? await ds.nearestShopMiles({
          orgId: inputs.orgId,
          brandCode: inputs.brandCode,
          originAddress: inputs.originAddress,
        })
      : null;
    if (nearest === null) {
      deadhead_skipped = true;
      explanation.push(
        "No shop configured for brand — deadhead fee skipped. Add shop addresses in Settings.",
      );
    }

    // Driveway vision pre-check (origin only; destination review happens after).
    if (inputs.originAddress) {
      driveway_flags = await ds.drivewayFlags({ address: inputs.originAddress });
      if (
        driveway_flags.narrow ||
        driveway_flags.gravel ||
        driveway_flags.low_clearance ||
        driveway_flags.long_walk
      ) {
        driveway_review_required = true;
        explanation.push(
          `Driveway flags at origin: ${Object.entries(driveway_flags)
            .filter(([, v]) => v)
            .map(([k]) => k)
            .join(", ")}. Shuttle fee auto-added.`,
        );
      }
    }

    const shuttle_default =
      (await ds.operationalFee({
        orgId: inputs.orgId,
        brandCode: inputs.brandCode,
        feeType: "shuttle",
        moveClass: pricing_mode,
      })) ?? branchCfg.default_shuttle_fee;
    const long_haul_prep_fee =
      (await ds.operationalFee({
        orgId: inputs.orgId,
        brandCode: inputs.brandCode,
        feeType: "long_haul_prep",
        moveClass: pricing_mode,
      })) ?? branchCfg.default_long_haul_prep_fee;
    const tv_crating_unit_fee =
      (await ds.operationalFee({
        orgId: inputs.orgId,
        brandCode: inputs.brandCode,
        feeType: "crating",
        moveClass: pricing_mode,
      })) ?? branchCfg.default_tv_crating_fee;
    const shuttle_fee = driveway_review_required ? shuttle_default : null;
    const tv_crating_count = inventory_totals?.oversized_tvs.length ?? 0;

    const specialty_fees = (inventory_totals?.specialty_items ?? []).map((label) => ({
      label: `Specialty handling — ${label}`,
      fee: branchCfg.default_specialty_fee,
    }));

    const comp = composeLongDistance({
      weight_lb: Math.round(weight_lb),
      total_miles: total_miles ?? 0,
      linehaul_rate_per_lb: linehaul_rate,
      fuel_surcharge_pct: fuel_pct,
      deadhead_miles: nearest,
      deadhead_cost_per_mile: branchCfg.deadhead_cost_per_mile,
      long_haul_prep_fee,
      shuttle_fee,
      tv_crating_count,
      tv_crating_unit_fee,
      specialty_fees,
      contracted_cu_ft: Math.round(cu_ft),
    });
    extra_line_items = comp.line_items;
    estimated_revenue = comp.line_items.reduce((sum, l) => sum + l.total, 0);
  } else {
    // Local pricing — use the brand rate card as ground truth, not the
    // historical stat's amount_p50 which can drift based on historical
    // discounts / upsells. Revenue = crew_rate × hours. If historical hours
    // aren't available, fall back to the amount_p50 estimate.
    const hours = statsResolved?.hours_p50 ?? 0;
    const crew = statsResolved?.crew_mode ?? 3;
    // Truck count: default 1 for now. Future work: infer from total_cu_ft or
    // from move-size category.
    const trucks = 1;
    if (hours > 0) {
      const hourlyRate = hourlyRateForCrew(branchCfg, crew, trucks);
      estimated_revenue = Math.round(hours * hourlyRate * 100) / 100;
      explanation.push(
        `Local revenue: ${hours.toFixed(1)} hrs × $${hourlyRate.toFixed(2)}/hr (${crew}-man crew, ${trucks} truck, rate card $${branchCfg.rate_base_2man_1truck} + $${branchCfg.rate_per_extra_man}/extra man) = $${estimated_revenue.toFixed(2)}.`,
      );
    } else {
      estimated_revenue = statsResolved?.amount_p50 ?? 0;
      explanation.push("Local revenue: falling back to historical amount_p50 (no hour prediction).");
    }
  }

  // Material line items
  for (const m of materials) {
    const unit = m.unit_price ?? 0;
    extra_line_items.push({
      label: `Materials — ${m.sku} (recommended qty)`,
      qty: m.qty,
      unit_price: unit,
      total: unit * m.qty,
      kind: "material",
    });
    estimated_revenue += unit * m.qty;
  }

  extra_line_items.push({
    label: `Valuation protection — ${valuationOut.recommended}`,
    qty: 1,
    unit_price: 0,
    total: 0,
    kind: "valuation",
  });

  // Bulky-article flat charges (15-C Item 140).
  const bulkyLines = bulkyLineItems(bulkyMatches);
  if (bulkyLines.length > 0) {
    extra_line_items.push(...bulkyLines);
    estimated_revenue += bulkyLines.reduce((s, l) => s + l.total, 0);
  }

  // Access fees — 15-C Items 160/165. Per 100 lb of SHIPMENT weight, not the
  // linehaul billable weight. Item 140 weight additives are a linehaul billing
  // construct (boats/trailers/campers); they must not inflate the customer's
  // per-flight stairs or elevator charge. Pass `baseline_weight_lb`.
  if (inputs.access) {
    const inferredStairs =
      inputs.access.stairs ?? inventory_totals?.stairs_count ?? 0;
    const accessLines = composeAccessFees({
      stairs: inferredStairs,
      elevator: !!inputs.access.elevator,
      long_carry_ft: inputs.access.long_carry ? 125 : undefined,
      weight_lb: baseline_weight_lb,
    });
    if (accessLines.length > 0) {
      extra_line_items.push(...accessLines);
      estimated_revenue += accessLines.reduce((s, l) => s + l.total, 0);
    }
  }

  // ── 6. Margin check using split labor + truck cost. ──
  const estimated_direct_cost = estimateDirectCost({
    pricing_mode,
    total_miles,
    weight_lb,
    hours: statsResolved?.hours_p50 ?? 0,
    crew: statsResolved?.crew_mode ?? 3,
    trucks: 1,
    burdenedPerWorker: branchCfg.burdened_per_worker_hour,
    truckCostPerHour: branchCfg.truck_cost_per_hour,
  });
  const margin = checkMargin({ estimated_revenue, estimated_direct_cost, policy });
  explanation.push(
    `Margin: ${margin.gross_margin_pct.toFixed(1)}% (target ${policy.target_margin_pct}%, min ${policy.min_margin_pct}%; labor $${branchCfg.burdened_per_worker_hour}/worker-hr, truck $${branchCfg.truck_cost_per_hour}/hr).`,
  );

  return {
    pricing_mode,
    estimate_type,
    estimate_input: {
      move_type: pricing_mode === "long_distance" ? "long_distance" : "local",
      move_size: inputs.moveCategory,
      origin_zip: inputs.originZip,
      dest_zip: inputs.destZip,
      service_date: inputs.serviceDate,
      estimated_hours: statsResolved?.hours_p50 ?? undefined,
      crew_size: statsResolved?.crew_mode ?? undefined,
      truck_size: statsResolved?.truck_mode ?? undefined,
      total_weight_lb: Math.round(weight_lb) || undefined,
      total_cu_ft: Math.round(cu_ft) || undefined,
      total_miles: total_miles ?? undefined,
    },
    extra_line_items,
    materials,
    valuation: valuationOut,
    margin,
    driveway_review_required,
    driveway_flags,
    deadhead_skipped,
    confidence,
    comparable_sample_n: statsResolved?.sample_n ?? 0,
    inventory_totals,
    explanation,
  };
}

function estimateDirectCost(args: {
  pricing_mode: PricingMode;
  total_miles: number | null;
  weight_lb: number;
  hours: number;
  crew: number;
  trucks: number;
  burdenedPerWorker: number;
  truckCostPerHour: number;
}): number {
  const {
    pricing_mode,
    total_miles,
    weight_lb,
    hours,
    crew,
    trucks,
    burdenedPerWorker,
    truckCostPerHour,
  } = args;
  const laborCost = hours * crew * burdenedPerWorker;
  const truckCost = hours * trucks * truckCostPerHour;

  if (pricing_mode === "local") {
    return Math.round(laborCost + truckCost);
  }
  // Long-distance: add drive time, fuel, hotels. Deadhead is a separate line
  // item on the revenue side already.
  const miles = total_miles ?? 0;
  const driveHours = miles / 55;
  const driveLabor = driveHours * crew * burdenedPerWorker; // crew driving counts as paid time
  const fuelCost = (miles / 8) * 4.25;
  const hotelCost = miles > 500 ? Math.ceil(miles / 550) * 450 : 0;
  const truckWearMileBased = miles * 0.35;
  return Math.round(
    laborCost + truckCost + driveLabor + fuelCost + hotelCost + truckWearMileBased + weight_lb * 0.05,
  );
}
