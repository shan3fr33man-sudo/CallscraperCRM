import { z } from "zod";

export const moveCategorySchema = z.enum([
  "single_item",
  "1br",
  "2br",
  "3br",
  "condo",
  "apartment",
  "townhouse",
  "commercial",
]);
export type MoveCategory = z.infer<typeof moveCategorySchema>;

export const pricingModeSchema = z.enum(["local", "long_distance"]);
export type PricingMode = z.infer<typeof pricingModeSchema>;

export const seasonSchema = z.enum(["winter", "spring", "summer", "fall", "any"]);
export type Season = z.infer<typeof seasonSchema>;

export const distanceBucketSchema = z.enum([
  "local_under_25mi",
  "25_100mi",
  "100_500mi",
  "500_1500mi",
  "1500_plus_mi",
  "unknown",
]);
export type DistanceBucket = z.infer<typeof distanceBucketSchema>;

/** Normalized inventory row. Items with empty dimensions fall back to lookup by name. */
export interface InventoryItem {
  room: string;
  level?: string;
  name: string;
  qty: number;
  lwh_ft?: string;
  disassemble?: boolean;
  /** Optional box-row marker: size in cu ft ("1.5 cubic foot boxes" → 1.5). */
  box_size_cu_ft?: number;
}

export interface InventoryTotals {
  total_cu_ft: number;
  total_weight_lb: number;
  disassembly_count: number;
  specialty_items: string[];
  oversized_tvs: string[];
  stairs_count: number;
  items_without_dimensions: number;
}

export interface PredictInputs {
  orgId: string;
  /** `branches.brand_code` — APM | AFM | crewready | apex. Required so the
   *  estimator scopes statistics and config to the right brand. */
  brandCode: string;
  moveCategory: MoveCategory;
  originAddress?: string;
  destAddress?: string;
  originZip?: string;
  destZip?: string;
  originState?: string;
  destState?: string;
  serviceDate: string; // ISO date
  inventory?: InventoryItem[];
  access?: {
    stairs?: number;
    elevator?: boolean;
    long_carry?: boolean;
    specialty?: string[];
  };
}

/** Per-brand tunable constants. Seeded in `estimator_branch_config`. */
export interface BranchConfig {
  // ── Revenue side: customer-facing rate card for local moves ──
  /** $/hr for a 2-man crew + 1 truck — the base rate. */
  rate_base_2man_1truck: number;
  /** $/hr added per additional mover beyond 2. */
  rate_per_extra_man: number;
  /** $/hr added per additional truck beyond 1. */
  rate_per_extra_truck: number;

  // ── Cost side ──
  /** Fully burdened LABOR cost per worker per hour (excludes truck). */
  burdened_per_worker_hour: number;
  /** Per-truck per-hour operational cost (fuel + depreciation + insurance + maint). Local moves. */
  truck_cost_per_hour: number;
  /** Per-mile deadhead cost (yard → origin) for long-haul moves. */
  deadhead_cost_per_mile: number;

  // ── Sales tax (applied to material line items only per WAC 458-20-118) ──
  sales_tax_pct: number;

  // ── Long-distance operational fee defaults ──
  default_shuttle_fee: number;
  default_long_haul_prep_fee: number;
  default_tv_crating_fee: number;
  default_specialty_fee: number;
  default_fuel_surcharge_pct: number;

  // ── Linehaul rate policy ──
  linehaul_rate_mode: "min" | "midpoint" | "max" | "custom";
  linehaul_rate_custom_per_lb?: number;

  /** @deprecated Use burdened_per_worker_hour. Kept on the type until
   *  migration 0014 callers all switch over. */
  burdened_hourly?: number;
}

/** Computed revenue for a given crew size + truck count, using the brand rate card. */
export function hourlyRateForCrew(
  cfg: Pick<BranchConfig, "rate_base_2man_1truck" | "rate_per_extra_man" | "rate_per_extra_truck">,
  crew: number,
  trucks: number,
): number {
  const extraMen = Math.max(0, crew - 2);
  const extraTrucks = Math.max(0, trucks - 1);
  return cfg.rate_base_2man_1truck + extraMen * cfg.rate_per_extra_man + extraTrucks * cfg.rate_per_extra_truck;
}

export interface MaterialRecommendation {
  sku: string;
  qty: number;
  unit_price?: number;
  confidence: number;
}

export interface LineItem {
  label: string;
  qty: number;
  unit_price: number;
  total: number;
  kind:
    | "linehaul"
    | "fuel_surcharge"
    | "labor"
    | "deadhead"
    | "shuttle"
    | "long_haul_prep"
    | "crating"
    | "packing"
    | "material"
    | "valuation"
    | "overflow_clause"
    | "other";
}

export interface MarginResult {
  gross_margin_pct: number;
  status: "ok" | "warn" | "block";
  reason?: string;
  estimated_revenue: number;
  estimated_direct_cost: number;
}

export interface PredictionResult {
  pricing_mode: PricingMode;
  estimate_type: "binding" | "non_binding";
  /** Inputs for `calculateEstimate()` from @callscrapercrm/pricing. */
  estimate_input: {
    move_type: string;
    move_size?: string;
    origin_zip?: string;
    dest_zip?: string;
    service_date: string;
    estimated_hours?: number;
    crew_size?: number;
    truck_size?: string;
    total_weight_lb?: number;
    total_cu_ft?: number;
    total_miles?: number;
  };
  extra_line_items: LineItem[];
  materials: MaterialRecommendation[];
  valuation: {
    recommended: "basic" | "full";
    declared_value?: number;
    confidence: number;
  };
  margin: MarginResult;
  driveway_review_required: boolean;
  driveway_flags: {
    narrow: boolean;
    gravel: boolean;
    low_clearance: boolean;
    long_walk: boolean;
  };
  deadhead_skipped: boolean;
  confidence: number;
  comparable_sample_n: number;
  inventory_totals?: InventoryTotals;
  /** Human-readable explanation for UI ("why these numbers?"). */
  explanation: string[];
}
