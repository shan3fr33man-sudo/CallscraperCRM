import type { InventoryItem, InventoryTotals } from "./types";

/**
 * Cubic-feet + weight estimation from a normalized inventory array.
 *
 * Precedence for each item's cu-ft:
 *   1. explicit `lwh_ft` string parsed to dimensions and multiplied
 *   2. explicit `box_size_cu_ft` × qty (box rows)
 *   3. name-keyed lookup in ITEM_CU_FT_DEFAULTS
 *   4. class fallback by keyword match
 *
 * Weight = cu_ft × density; density is 7 lb/cu-ft average but overridden for
 * item classes where it's systematically off (books, tools, textiles). After
 * the historical scrape lands, we can replace these hardcoded densities with
 * per-class medians pulled from historical_jobs.inventory_json.
 */

/** Defaults chosen from industry norms. Replace with scrape-derived values. */
export const ITEM_CU_FT_DEFAULTS: Record<string, number> = {
  // Living room
  sectional: 50,
  sofa: 35,
  loveseat: 22,
  recliner: 22,
  ottoman: 8,
  coffee_table: 15,
  end_table: 8,
  tv_stand: 12,
  entertainment_center: 40,
  bookshelf: 25,
  bookcase: 25,
  // Bedrooms
  king_bed_frame: 50,
  queen_bed_frame: 40,
  full_bed_frame: 30,
  twin_bed_frame: 22,
  king_mattress: 60,
  queen_mattress: 45,
  full_mattress: 35,
  twin_mattress: 25,
  boxspring: 35,
  dresser: 35,
  nightstand: 10,
  armoire: 45,
  // Dining
  dining_table: 35,
  dining_chair: 6,
  china_cabinet: 50,
  // Kitchen
  refrigerator: 45,
  dishwasher: 20,
  microwave: 5,
  // Office
  desk: 30,
  office_chair: 10,
  file_cabinet: 15,
  computer_monitor: 4,
  // Appliances
  washer: 20,
  dryer: 20,
  // Outdoor / specialty
  piano_upright: 65,
  piano_grand: 110,
  gun_safe: 35,
  hot_tub: 150,
  treadmill: 35,
  elliptical: 35,
  exercise_bike: 20,
  // TVs by size
  tv_32: 6,
  tv_43: 10,
  tv_55: 18,
  tv_65: 22,
  tv_75: 28,
  tv_85: 36,
};

export const DEFAULT_DENSITY_LB_PER_CU_FT = 7;
export const ITEM_DENSITY_OVERRIDES: Array<{ match: RegExp; lbPerCuFt: number }> = [
  { match: /\bbooks?\b|bookcase/i, lbPerCuFt: 22 },
  { match: /\btools?\b|toolbox/i, lbPerCuFt: 18 },
  { match: /\bpillows?\b|bedding|comforter|quilt/i, lbPerCuFt: 3 },
  { match: /\bclothes\b|laundry/i, lbPerCuFt: 4 },
  { match: /\bsafe\b|gun safe/i, lbPerCuFt: 60 },
  { match: /piano/i, lbPerCuFt: 15 },
];

function parseLwh(s: string): number | null {
  const match = s.match(/([\d.]+)\s*x\s*([\d.]+)\s*x\s*([\d.]+)/i);
  if (!match) return null;
  const [, l, w, h] = match;
  const v = Number(l) * Number(w) * Number(h);
  return Number.isFinite(v) && v > 0 ? v : null;
}

function nameCuFt(name: string): number | null {
  const n = name.toLowerCase();
  // Direct key matches
  for (const [key, val] of Object.entries(ITEM_CU_FT_DEFAULTS)) {
    if (n.includes(key.replace(/_/g, " "))) return val;
  }
  // TVs — match size explicitly
  const tv = n.match(/(\d{2})\s*["”']?\s*tv/);
  if (tv) {
    const size = Number(tv[1]);
    if (size <= 35) return ITEM_CU_FT_DEFAULTS.tv_32;
    if (size <= 48) return ITEM_CU_FT_DEFAULTS.tv_43;
    if (size <= 60) return ITEM_CU_FT_DEFAULTS.tv_55;
    if (size <= 70) return ITEM_CU_FT_DEFAULTS.tv_65;
    if (size <= 80) return ITEM_CU_FT_DEFAULTS.tv_75;
    return ITEM_CU_FT_DEFAULTS.tv_85;
  }
  // Keyword fallbacks
  if (/\brug\b|\bcarpet\b/.test(n)) return 8;
  if (/\btote\b|\bbin\b/.test(n)) return 3;
  if (/\blamp\b/.test(n)) return 4;
  if (/\bchair\b/.test(n)) return 10;
  if (/\btable\b/.test(n)) return 15;
  if (/\bshelf\b|\bshelving\b/.test(n)) return 20;
  if (/\bbox\b/.test(n)) return 1.5;
  return null;
}

function densityFor(name: string): number {
  const lower = name.toLowerCase();
  for (const o of ITEM_DENSITY_OVERRIDES) if (o.match.test(lower)) return o.lbPerCuFt;
  return DEFAULT_DENSITY_LB_PER_CU_FT;
}

const SPECIALTY_PATTERNS = [
  /\bpiano\b/i,
  /\bsafe\b/i,
  /\bhot\s*tub\b/i,
  /\btreadmill\b/i,
  /\belliptical\b/i,
  /\bpool\s*table\b/i,
  /\bmotorcycle\b/i,
  /\bgun\s*safe\b/i,
];

export function computeInventoryTotals(items: InventoryItem[]): InventoryTotals {
  let total_cu_ft = 0;
  let total_weight_lb = 0;
  let disassembly_count = 0;
  let items_without_dimensions = 0;
  const specialty_items: string[] = [];
  const oversized_tvs: string[] = [];
  const stairLevels = new Set<string>();

  for (const item of items) {
    let cu_ft: number | null = null;
    if (item.box_size_cu_ft) cu_ft = item.box_size_cu_ft;
    else if (item.lwh_ft) cu_ft = parseLwh(item.lwh_ft);
    if (cu_ft === null) cu_ft = nameCuFt(item.name);
    if (cu_ft === null) {
      items_without_dimensions += 1;
      cu_ft = 10; // conservative default so we don't silently under-count
    }
    const qty = Math.max(1, item.qty);
    const itemCuFt = cu_ft * qty;
    total_cu_ft += itemCuFt;
    total_weight_lb += itemCuFt * densityFor(item.name);
    if (item.disassemble) disassembly_count += qty;

    if (SPECIALTY_PATTERNS.some((p) => p.test(item.name))) specialty_items.push(item.name);

    const tvMatch = item.name.match(/(\d{2})\s*["”']?\s*tv/i);
    if (tvMatch && Number(tvMatch[1]) >= 65) oversized_tvs.push(item.name);

    if (item.level) stairLevels.add(item.level.toLowerCase());
  }

  return {
    total_cu_ft: Math.round(total_cu_ft),
    total_weight_lb: Math.round(total_weight_lb),
    disassembly_count,
    specialty_items,
    oversized_tvs,
    stairs_count: Math.max(0, stairLevels.size - 1),
    items_without_dimensions,
  };
}
