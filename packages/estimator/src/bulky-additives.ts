/**
 * Tariff 15-C Item 140 — Bulky articles and weight additives.
 *
 * Some articles (boats, canopies, pianos, motorcycles, large TVs, etc.) take
 * up disproportionate space or need extra handling. 15-C specifies either a
 * flat additional charge OR a weight additive — not both — per article class.
 *
 * For linehaul purposes, the weight additive inflates the shipment's billed
 * weight. The additional charge is a separate line item on the estimate.
 *
 * Full list transcribed from Item 140 (pages 33-34). Where an article has
 * BOTH options per-variant (rare), we pick weight-additive because it
 * compounds correctly into the linehaul table.
 */
import type { InventoryItem, LineItem } from "./types";

export interface BulkyMatch {
  /** Original item row that matched. */
  item: InventoryItem;
  /** Lowercase label used for match (for the estimate explanation). */
  matched_as: string;
  /** Weight in lb added to the shipment for linehaul. 0 if this item has a flat charge instead. */
  weight_additive_lb: number;
  /** Flat additional charge (midpoint of min/max from the tariff). 0 if weight additive instead. */
  additional_charge: number;
}

interface BulkyRule {
  /** Regex on lowercased item name. */
  match: RegExp;
  /** Weight additive in lb (per article). Set to null when using flat charge. */
  weightAdditiveLb?: number;
  /** Flat additional charge min/max (per article). */
  additionalCharge?: { min: number; max: number };
  label: string;
}

const RULES: BulkyRule[] = [
  // Watercraft
  { match: /boat|sailboat/, weightAdditiveLb: 700, label: "boat (<14 ft)" }, // conservative default
  { match: /canoe|kayak|skiff|rowboat|dinghy/, additionalCharge: { min: 47.62, max: 153.31 }, label: "canoe/kayak" },
  // Motor-vehicles-adjacent
  { match: /motorcycle|motorbike|\bgo[- ]?cart\b|atv|four[- ]?wheeler/, additionalCharge: { min: 47.62, max: 153.31 }, label: "motorcycle" },
  { match: /jet\s*ski/, additionalCharge: { min: 47.62, max: 153.31 }, label: "jet ski" },
  { match: /snowmobile/, additionalCharge: { min: 47.62, max: 153.31 }, label: "snowmobile" },
  { match: /golf\s*cart/, additionalCharge: { min: 47.62, max: 153.31 }, label: "golf cart" },
  { match: /riding\s*lawn\s*mower|riding\s*mower/, additionalCharge: { min: 47.62, max: 153.31 }, label: "riding lawn mower" },
  { match: /tractor/, additionalCharge: { min: 47.62, max: 153.31 }, label: "tractor (<25hp)" },
  { match: /automobile|\bcar\b(?!\s*seat)/, additionalCharge: { min: 94.54, max: 304.33 }, label: "automobile" },
  { match: /pick[- ]?up\s*truck/, additionalCharge: { min: 94.54, max: 304.33 }, label: "pick-up truck" },
  // Structures
  { match: /hot\s*tub|spa|jacuzzi|whirlpool/, additionalCharge: { min: 88.72, max: 285.53 }, label: "hot tub" },
  { match: /shed|utility\s*shed|tool\s*shed/, additionalCharge: { min: 88.71, max: 285.53 }, label: "shed" },
  { match: /doll\s*house|playhouse/, additionalCharge: { min: 88.62, max: 285.98 }, label: "doll/playhouse" },
  { match: /animal\s*house|kennel/, additionalCharge: { min: 88.72, max: 285.53 }, label: "kennel" },
  // Entertainment / decor
  { match: /(\d{2,3})["”']?\s*tv\b/, additionalCharge: { min: 70.90, max: 228.24 }, label: "large TV (40\"+)" },
  { match: /grandfather\s*clock|grandmother\s*clock/, additionalCharge: { min: 23.68, max: 76.21 }, label: "grandfather clock" },
  // Trailers
  { match: /boat\s*trailer/, weightAdditiveLb: 1600, label: "boat trailer (no boat)" },
  { match: /horse\s*trailer/, weightAdditiveLb: 7000, label: "horse trailer" },
  { match: /travel\s*trailer|pop[- ]?up|travel\s*camper/, weightAdditiveLb: 7000, label: "travel trailer" },
  { match: /utility\s*trailer(?!\s*camper)/, additionalCharge: { min: 47.62, max: 153.31 }, label: "utility trailer" },
  // Large appliances / specialty
  { match: /camper|mobile\s*home/, weightAdditiveLb: 7000, label: "camper" },
  { match: /canopy(?!.*mounted)/, weightAdditiveLb: 700, label: "canopy" },
];

/**
 * Scan an inventory and return the bulky-additive matches. Adds weight (for
 * linehaul) and/or flat charges (for separate line items) per 15-C Item 140.
 *
 * Large TVs that ALSO have an OEM box are still charged — the tariff doesn't
 * distinguish. If the estimator wants to be lenient, filter these out in the
 * caller.
 */
export function detectBulkyAdditives(items: InventoryItem[]): BulkyMatch[] {
  const matches: BulkyMatch[] = [];
  for (const item of items) {
    const name = item.name.toLowerCase();
    for (const rule of RULES) {
      if (rule.match.test(name)) {
        const qty = Math.max(1, item.qty);
        const weightPer = rule.weightAdditiveLb ?? 0;
        const chargePer = rule.additionalCharge
          ? (rule.additionalCharge.min + rule.additionalCharge.max) / 2
          : 0;
        matches.push({
          item,
          matched_as: rule.label,
          weight_additive_lb: weightPer * qty,
          additional_charge: chargePer * qty,
        });
        break; // first rule wins per item
      }
    }
  }
  return matches;
}

export function bulkyLineItems(matches: BulkyMatch[]): LineItem[] {
  const lines: LineItem[] = [];
  for (const m of matches) {
    if (m.additional_charge > 0) {
      lines.push({
        label: `Bulky article (15-C Item 140) — ${m.matched_as}${m.item.qty > 1 ? ` × ${m.item.qty}` : ""}`,
        qty: m.item.qty,
        unit_price: m.additional_charge / m.item.qty,
        total: Math.round(m.additional_charge * 100) / 100,
        kind: "other",
      });
    }
  }
  return lines;
}

export function totalWeightAdditive(matches: BulkyMatch[]): number {
  return matches.reduce((s, m) => s + m.weight_additive_lb, 0);
}
