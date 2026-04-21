// Tariff + pricing domain types. Shared by server routes, worker, and browser preview.
// Matches the DB schema in packages/db/migrations/0002_river.sql (tariffs, tariff_rates, etc.)

export type RateKind =
  | "labor"
  | "truck"
  | "material"
  | "packing"
  | "travel"
  | "flat"
  | "mileage";

export type RateUnit = "hour" | "mile" | "cwt" | "flat" | "each" | "day";

export type ModifierKind =
  | "fuel_surcharge"
  | "long_carry"
  | "stairs"
  | "heavy_item"
  | "weekend"
  | "holiday"
  | "peak_season"
  | "elevator"
  | "shuttle";

export type ModifierFormulaType =
  | "percentage"
  | "flat"
  | "per_flight"
  | "per_100lbs"
  | "per_item";

export type ValuationCoverage =
  | "released_value"
  | "full_replacement"
  | "lump_sum";

export type EstimateType =
  | "binding"
  | "non_binding"
  | "binding_nte"
  | "hourly"
  | "flat_rate";

export type RoundingRule =
  | "none"
  | "nearest_cent"
  | "nearest_dollar"
  | "ceil_dollar"
  | "floor_dollar";

// ─── Tariff entity shapes (mirror DB rows) ──────────────────────────────

export interface TariffConfig {
  id: string;
  org_id: string;
  name: string;
  branch_id?: string | null;
  service_type?: string | null;
  effective_from?: string | null; // YYYY-MM-DD
  effective_to?: string | null;
  currency: string; // "USD"
  rounding_rule: RoundingRule;
  is_default: boolean;
  archived: boolean;
}

export interface TariffRate {
  id: string;
  tariff_id: string;
  kind: RateKind;
  label: string | null;
  base_rate: number;
  min_charge: number;
  unit: RateUnit;
  conditions_json: Record<string, unknown>;
}

export interface TariffTier {
  id: string;
  tariff_rate_id: string;
  threshold: number; // units (hours, miles, etc.) above which this tier kicks in
  rate: number; // new per-unit rate once threshold met
}

export interface TariffModifierFormula {
  type: ModifierFormulaType;
  value: number;
  condition?: Record<string, unknown>;
}

export interface TariffModifier {
  id: string;
  tariff_id: string;
  kind: ModifierKind;
  label?: string | null;
  formula_json: TariffModifierFormula;
  stacking_order: number;
}

export interface TariffValuation {
  id: string;
  tariff_id: string;
  name: string;
  coverage_type: ValuationCoverage;
  deductible: number;
  rate_per_thousand: number;
}

export interface TariffHandicap {
  id: string;
  tariff_id: string;
  name: string;
  multiplier: number;
  condition_json: Record<string, unknown>;
}

export interface TariffAssignment {
  id: string;
  tariff_id: string;
  branch_id?: string | null;
  opportunity_type?: string | null;
  service_type?: string | null;
  priority: number;
}

/** Full tariff with all children eager-loaded — the shape the engine consumes. */
export interface FullTariff extends TariffConfig {
  rates: (TariffRate & { tiers?: TariffTier[] })[];
  modifiers: TariffModifier[];
  valuations: TariffValuation[];
  handicaps: TariffHandicap[];
  assignments: TariffAssignment[];
}

// ─── Pricing engine input/output ────────────────────────────────────────

export interface InventoryItem {
  name: string;
  quantity: number;
  weight_lbs?: number;
  cubic_feet?: number;
  is_heavy?: boolean;
}

export interface RoomInventory {
  room_name: string;
  items: InventoryItem[];
}

export interface EstimateInput {
  move_type: string; // "local_move" | "long_distance" | "commercial" | "labor_only" | etc.
  move_size?: string | null; // "studio", "1br", "2br", etc.
  origin?: Record<string, unknown> | null;
  destination?: Record<string, unknown> | null;
  service_date?: string | null; // YYYY-MM-DD
  crew_size?: number | null;
  truck_count?: number | null;
  estimated_hours?: number | null;
  weight_lbs?: number | null;
  distance_miles?: number | null;
  rooms?: RoomInventory[];
  special_items?: string[];
  floor_origin?: number | null; // 1 = ground, 2+ means stairs
  floor_destination?: number | null;
  elevator_origin?: boolean | null;
  elevator_destination?: boolean | null;
  long_carry_origin_ft?: number | null;
  long_carry_destination_ft?: number | null;
  packing_required?: boolean | null;
  valuation_choice?: string | null; // name of TariffValuation row
  declared_value?: number | null; // for full_replacement
}

export interface PricingLineItem {
  rate_id: string;
  label: string;
  kind: RateKind;
  rate: number;
  quantity: number;
  unit: RateUnit;
  subtotal: number;
}

export interface AppliedModifier {
  modifier_id: string;
  label: string;
  kind: ModifierKind;
  amount: number;
  formula: TariffModifierFormula;
  applied_to: string; // which base it was applied to ("labor+truck", "total", "per_flight")
}

export interface AppliedHandicap {
  handicap_id: string;
  name: string;
  multiplier: number;
  amount: number;
}

export interface PricingResult {
  line_items: PricingLineItem[];
  subtotal: number;
  modifiers_applied: AppliedModifier[];
  modifiers_total: number;
  handicaps_applied: AppliedHandicap[];
  handicaps_total: number;
  valuation_charge: number;
  pre_discount_total: number;
  discount: number;
  taxable_amount: number;
  sales_tax: number;
  total: number;
  tariff_id: string;
  tariff_snapshot: FullTariff;
  estimate_type: EstimateType;
  trace: string[]; // human-readable "why this number" explanation
}

export interface PricingOptions {
  estimate_type?: EstimateType;
  discount_pct?: number;
  discount_flat?: number;
  tax_rate?: number; // decimal, e.g. 0.089 for 8.9%
}

export interface TariffContext {
  branch_id?: string | null;
  opportunity_type?: string | null;
  service_type?: string | null;
}
