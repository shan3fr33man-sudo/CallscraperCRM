/**
 * Washington State Tariff 15-C — Household Goods
 *
 * Constants and lookup tables from Tariff TV-250890 effective 2026-01-01.
 * Source: WA Utilities and Transportation Commission, filed January 1, 2026.
 *
 * Philosophy: the estimator returns MIN/MAX bounds from the tariff, and the
 * caller chooses a concrete rate between them based on brand policy (a carrier
 * filed rate). The estimator does NOT pick an arbitrary point — it just clamps
 * to the legal range. A carrier-specific default rate may live in a DB config
 * row (future work); for v1 we use the midpoint.
 *
 * ⚠ When WA UTC republishes 15-C, update this file and bump the effective
 * date constant at the top. The CRM's settings/estimator page should surface
 * this date so agents know which tariff version drives current estimates.
 */

export const TARIFF_VERSION = "15-C (TV-250890)";
export const TARIFF_EFFECTIVE_DATE = "2026-01-01";

/** Item 10 — constructive weight minimum. */
export const CONSTRUCTIVE_LB_PER_CU_FT = 7;

/** Item 105(1) — rates in Section 2 apply to moves OVER 55 miles. Local (hourly-rated) = ≤55 mi. */
export const LONG_DISTANCE_THRESHOLD_MILES = 55;

/** Item 145(1) — 5,000+ lb shipments must be expedited (no consolidation delay). */
export const EXPEDITE_WEIGHT_THRESHOLD_LB = 5_000;

/** Item 185(3) — free waiting time before billable. */
export const WAITING_FREE_TIME = [
  { loadedMilesMax: 200, freeHours: 1 },
  { loadedMilesMax: Infinity, freeHours: 2 },
] as const;

/**
 * Item 90 — Customer valuation options.
 *   Option 1: Basic Value Protection at $0.72/lb/item (FREE).
 *   Option 2: Replacement Cost w/ $300 deductible. Declared value ≥ $9.16 × net weight.
 *   Option 3: Replacement Cost w/o deductible. Declared value ≥ $9.16 × net weight.
 *
 * When the customer makes no selection, 15-C defaults them to Replacement
 * Cost (full) protection.
 */
export const VALUATION = {
  BASIC_PER_LB: 0.72,
  FULL_VALUE_MULTIPLIER_PER_LB: 9.16,
  DEFAULT_WHEN_NOT_SELECTED: "full_with_deductible" as const,
  FULL_DEDUCTIBLE: 300,
} as const;

/**
 * Item 200 — Long-distance mileage rates. Minimum / maximum $/lb published
 * per weight bracket × loaded-distance bracket. Effective 2026-01-01.
 *
 * Structure: `MILEAGE_RATES[weightBracket][distanceBracket] = { min, max }`.
 * For loaded distance > 560 mi, add the per-20mi adder (bracket-specific)
 * to the 540-560 mi row using `overAdder`.
 */
export type WeightBracket =
  | "500_999"
  | "1000_1999"
  | "2000_3999"
  | "4000_7999"
  | "8000_11999"
  | "12000_15999"
  | "16000_plus";

export function weightBracket(lb: number): WeightBracket {
  if (lb < 1000) return "500_999";
  if (lb < 2000) return "1000_1999";
  if (lb < 4000) return "2000_3999";
  if (lb < 8000) return "4000_7999";
  if (lb < 12000) return "8000_11999";
  if (lb < 16000) return "12000_15999";
  return "16000_plus";
}

interface RateRow {
  overMi: number;
  toMi: number;
  min: number;
  max: number;
}

/** Rates are $/lb. Data transcribed from 2026 Tariff 15-C Item 200, pages 42–45. */
export const MILEAGE_RATES: Record<WeightBracket, RateRow[]> = {
  "500_999": [
    { overMi: 55, toMi: 60, min: 0.257, max: 1.4291 },
    { overMi: 60, toMi: 70, min: 0.2666, max: 1.5449 },
    { overMi: 70, toMi: 80, min: 0.2737, max: 1.6593 },
    { overMi: 80, toMi: 90, min: 0.2805, max: 1.7738 },
    { overMi: 90, toMi: 100, min: 0.2868, max: 1.8881 },
    { overMi: 100, toMi: 120, min: 0.2932, max: 2.0026 },
    { overMi: 120, toMi: 150, min: 0.3055, max: 2.1743 },
    { overMi: 150, toMi: 200, min: 0.3218, max: 2.4317 },
    { overMi: 200, toMi: 300, min: 0.3572, max: 2.8608 },
    { overMi: 300, toMi: 400, min: 0.4013, max: 3.433 },
    { overMi: 400, toMi: 500, min: 0.4422, max: 4.0053 },
    { overMi: 500, toMi: 560, min: 0.4803, max: 4.4537 },
  ],
  "1000_1999": [
    { overMi: 55, toMi: 60, min: 0.1633, max: 0.8577 },
    { overMi: 60, toMi: 100, min: 0.1696, max: 0.9149 },
    { overMi: 100, toMi: 150, min: 0.1923, max: 1.1438 },
    { overMi: 150, toMi: 200, min: 0.2233, max: 1.4298 },
    { overMi: 200, toMi: 300, min: 0.2559, max: 1.6441 },
    { overMi: 300, toMi: 400, min: 0.2936, max: 1.8586 },
    { overMi: 400, toMi: 500, min: 0.3294, max: 2.2875 },
    { overMi: 500, toMi: 560, min: 0.3627, max: 2.7164 },
  ],
  "2000_3999": [
    { overMi: 55, toMi: 60, min: 0.1335, max: 0.6432 },
    { overMi: 60, toMi: 100, min: 0.1394, max: 0.6718 },
    { overMi: 100, toMi: 150, min: 0.1581, max: 0.7861 },
    { overMi: 150, toMi: 200, min: 0.176, max: 0.9401 },
    { overMi: 200, toMi: 300, min: 0.2006, max: 1.0721 },
    { overMi: 300, toMi: 400, min: 0.2419, max: 1.1794 },
    { overMi: 400, toMi: 500, min: 0.2769, max: 1.2863 },
    { overMi: 500, toMi: 560, min: 0.3083, max: 1.4708 },
  ],
  "4000_7999": [
    { overMi: 55, toMi: 60, min: 0.1224, max: 0.6011 },
    { overMi: 60, toMi: 100, min: 0.1251, max: 0.6278 },
    { overMi: 100, toMi: 150, min: 0.1394, max: 0.7346 },
    { overMi: 150, toMi: 200, min: 0.1561, max: 0.8683 },
    { overMi: 200, toMi: 300, min: 0.1744, max: 0.9685 },
    { overMi: 300, toMi: 400, min: 0.2034, max: 1.0686 },
    { overMi: 400, toMi: 500, min: 0.2364, max: 1.2189 },
    { overMi: 500, toMi: 560, min: 0.2634, max: 1.3691 },
  ],
  "8000_11999": [
    { overMi: 55, toMi: 60, min: 0.1112, max: 0.5762 },
    { overMi: 60, toMi: 100, min: 0.1148, max: 0.6036 },
    { overMi: 100, toMi: 150, min: 0.1263, max: 0.7133 },
    { overMi: 150, toMi: 200, min: 0.1426, max: 0.7957 },
    { overMi: 200, toMi: 300, min: 0.1613, max: 0.8781 },
    { overMi: 300, toMi: 400, min: 0.1883, max: 0.9878 },
    { overMi: 400, toMi: 500, min: 0.2165, max: 1.0976 },
    { overMi: 500, toMi: 560, min: 0.2419, max: 1.2845 },
  ],
  "12000_15999": [
    { overMi: 55, toMi: 60, min: 0.1009, max: 0.5235 },
    { overMi: 60, toMi: 100, min: 0.1053, max: 0.5431 },
    { overMi: 100, toMi: 150, min: 0.1148, max: 0.6359 },
    { overMi: 150, toMi: 200, min: 0.1299, max: 0.7339 },
    { overMi: 200, toMi: 300, min: 0.1454, max: 0.8073 },
    { overMi: 300, toMi: 400, min: 0.1688, max: 0.8805 },
    { overMi: 400, toMi: 500, min: 0.1955, max: 1.0519 },
    { overMi: 500, toMi: 560, min: 0.2189, max: 1.223 },
  ],
  "16000_plus": [
    { overMi: 55, toMi: 60, min: 0.0862, max: 0.4304 },
    { overMi: 60, toMi: 100, min: 0.0894, max: 0.454 },
    { overMi: 100, toMi: 150, min: 0.0989, max: 0.5478 },
    { overMi: 150, toMi: 200, min: 0.1112, max: 0.6262 },
    { overMi: 200, toMi: 300, min: 0.1247, max: 0.7044 },
    { overMi: 300, toMi: 400, min: 0.1438, max: 0.7827 },
    { overMi: 400, toMi: 500, min: 0.1684, max: 0.8608 },
    { overMi: 500, toMi: 560, min: 0.1879, max: 1.0165 },
  ],
};

/** Adder per 20 mi (or fraction) beyond 560 miles. 15-C item 200 footer. */
export const OVER_560_ADDER: Record<WeightBracket, { min: number; max: number }> = {
  "500_999":    { min: 0.0056, max: 0.0878 },
  "1000_1999":  { min: 0.0056, max: 0.0878 },
  "2000_3999":  { min: 0.0034, max: 0.0397 },
  "4000_7999":  { min: 0.0034, max: 0.0397 },
  "8000_11999": { min: 0.0028, max: 0.0358 },
  "12000_15999":{ min: 0.0024, max: 0.0358 },
  "16000_plus": { min: 0.002,  max: 0.0259 },
};

export interface LinehaulRateRange {
  min_per_lb: number;
  max_per_lb: number;
  /** Midpoint — a sensible "carrier-filed" default absent brand config. */
  mid_per_lb: number;
  weight_bracket: WeightBracket;
  distance_row: string;
}

/** Returns the $/lb range for a given weight + loaded distance. */
export function lookupLinehaul(lb: number, miles: number): LinehaulRateRange {
  const bracket = weightBracket(lb);
  const rows = MILEAGE_RATES[bracket];
  if (miles <= LONG_DISTANCE_THRESHOLD_MILES) {
    throw new Error(`lookupLinehaul: ${miles} mi is local (<= 55 mi); not a long-distance rate`);
  }

  let row: RateRow | undefined;
  if (miles <= 560) {
    row = rows.find((r) => miles > r.overMi && miles <= r.toMi);
    if (!row) row = rows[rows.length - 1];
    return {
      min_per_lb: row.min,
      max_per_lb: row.max,
      mid_per_lb: round4((row.min + row.max) / 2),
      weight_bracket: bracket,
      distance_row: `${row.overMi}-${row.toMi} mi`,
    };
  }

  // Over 560 mi: start from 540–560 row, add per-20 mi adder (fractional rounded up).
  const base = rows[rows.length - 1];
  const adder = OVER_560_ADDER[bracket];
  const steps = Math.ceil((miles - 560) / 20);
  const min = round4(base.min + steps * adder.min);
  const max = round4(base.max + steps * adder.max);
  return {
    min_per_lb: min,
    max_per_lb: max,
    mid_per_lb: round4((min + max) / 2),
    weight_bracket: bracket,
    distance_row: `${miles} mi (540-560 + ${steps}×20mi adder)`,
  };
}

/**
 * Item 160 — Long-carry charges: per 100 lb, per 50 ft beyond the first 75 ft.
 * Item 165 — Stairs: per 100 lb per flight. Elevator: per 100 lb.
 */
export const ACCESS_CHARGES_PER_100LB = {
  LONG_CARRY_PER_50FT: { min: 0.69, max: 2.53 },
  STAIRS_PER_FLIGHT:    { min: 0.69, max: 2.53 },
  ELEVATOR:             { min: 1.04, max: 3.77 },
} as const;

/** Item 170 — Piano & organ handling. */
export const PIANO_CHARGES = {
  PIANO_NOT_SPINET: { min: 43.69, max: 157.71 },
  SPINET_OR_ORGAN:  { min: 17.48, max: 63.11 },
  FIRST_FLIGHT_STAIRS:     { min: 8.74, max: 31.53 },
  ADDITIONAL_FLIGHT_STAIRS:{ min: 4.37, max: 15.76 },
} as const;

/** Item 155 — Additional (multi-stop) service. */
export const ADDITIONAL_STOP_FEE = { min: 30.59, max: 110.41 };

/** Item 190 — Overtime. */
export const OVERTIME_CHARGES = {
  WEEKEND_HOLIDAY_PER_100LB: { min: 2.18, max: 6.32 },
  WEEKNIGHT_PER_PERSON_PER_HOUR: { min: 11.38, max: 32.85 },
} as const;

/**
 * Item 195/225 — Material prices. Min/max per container. Long-distance
 * pricing (Item 195) is higher than local (Item 225); the estimator picks
 * the right map based on pricing_mode.
 */
export interface MaterialPrice { min: number; max: number }
export type MaterialSku =
  | "box_under_5cf"
  | "box_3cf"
  | "box_4p5cf"
  | "box_6cf"
  | "dish_pack"
  | "wardrobe"
  | "mattress_twin"
  | "mattress_double"
  | "mattress_queen"
  | "mattress_king"
  | "mattress_king_boxspring"
  | "mattress_cover_twin"
  | "mattress_cover_double"
  | "mattress_cover_queen"
  | "mattress_cover_king"
  | "lamp"
  | "mirror"
  | "flat_screen_tv";

export const MATERIAL_PRICES_LONG_DISTANCE: Record<MaterialSku, MaterialPrice> = {
  box_under_5cf:    { min: 6.26,  max: 24.50 },
  box_3cf:          { min: 9.06,  max: 36.89 },
  box_4p5cf:        { min: 11.15, max: 45.27 },
  box_6cf:          { min: 12.37, max: 50.60 },
  dish_pack:        { min: 23.45, max: 98.23 },
  wardrobe:         { min: 14.52, max: 63.24 },
  mattress_twin:    { min: 8.94,  max: 41.05 },
  mattress_double:  { min: 11.83, max: 53.57 },
  mattress_queen:   { min: 15.01, max: 66.51 },
  mattress_king:    { min: 18.30, max: 83.72 },
  mattress_king_boxspring: { min: 15.34, max: 91.36 },
  mattress_cover_twin:   { min: 6.84,  max: 25.11 },
  mattress_cover_double: { min: 8.82,  max: 31.97 },
  mattress_cover_queen:  { min: 12.85, max: 45.56 },
  mattress_cover_king:   { min: 13.59, max: 48.16 },
  lamp:             { min: 5.83,  max: 21.57 },
  mirror:           { min: 15.80, max: 67.76 },
  flat_screen_tv:   { min: 37.95, max: 501.82 },
};

export const MATERIAL_PRICES_LOCAL: Record<MaterialSku, MaterialPrice> = {
  box_under_5cf:    { min: 2.08,  max: 10.35 },
  box_3cf:          { min: 3.10,  max: 15.39 },
  box_4p5cf:        { min: 3.72,  max: 18.46 },
  box_6cf:          { min: 4.38,  max: 21.75 },
  dish_pack:        { min: 10.05, max: 49.86 },
  wardrobe:         { min: 7.91,  max: 38.89 },
  mattress_twin:    { min: 6.47,  max: 32.11 },
  mattress_double:  { min: 8.05,  max: 39.89 },
  mattress_queen:   { min: 9.11,  max: 45.21 },
  mattress_king:    { min: 13.05, max: 64.75 },
  mattress_king_boxspring: { min: 14.89, max: 73.90 },
  mattress_cover_twin:   { min: 4.95,  max: 19.65 },
  mattress_cover_double: { min: 6.00,  max: 23.82 },
  mattress_cover_queen:  { min: 7.80,  max: 30.98 },
  mattress_cover_king:   { min: 8.25,  max: 32.74 },
  lamp:             { min: 4.38,  max: 17.40 },
  mirror:           { min: 8.04,  max: 39.21 },
  flat_screen_tv:   { min: 28.75, max: 393.19 },
};

/**
 * Item 85(3)(q) — nonbinding estimate rules.
 *   - Customer must pay ≤110% of estimate at delivery to take possession.
 *   - Customer not required to pay >125% unless supplemental estimate signed.
 *   - Above 125% requires carrier to prepare and customer to accept a
 *     supplemental estimate BEFORE additional work is performed.
 */
export const NONBINDING_LIMITS = { PAY_AT_DELIVERY_PCT: 1.10, FINAL_CAP_PCT: 1.25 } as const;

/**
 * Item 85(4) — supplemental estimate language. Replaces the colloquial
 * "overflow clause" some carriers informally append — 15-C specifies the
 * mechanism is a signed supplemental, not a per-box adder.
 */
export const SUPPLEMENTAL_CLAUSE_TEXT =
  "Any services, articles, or conditions not identified on this estimate require a supplemental estimate, signed by the customer before additional work is performed (WA Tariff 15-C, Item 85(4); WAC 480-15).";

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
