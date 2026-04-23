import type { LineItem } from "./types";
import { SUPPLEMENTAL_CLAUSE_TEXT } from "./tariff-15c";

/**
 * Long-distance line-item composition.
 *
 * Input shape is deliberately pre-resolved — the orchestrator (predict.ts)
 * does the stat/policy lookups, this module just turns numbers into line
 * items and the overflow-clause text. Keeping it free of DB access makes it
 * trivial to unit-test.
 */

export interface LongDistanceInputs {
  weight_lb: number;
  total_miles: number;
  linehaul_rate_per_lb: number;          // $/lb, e.g. 0.95
  fuel_surcharge_pct: number;            // 0..1, e.g. 0.12
  deadhead_miles: number | null;         // null if no shop configured
  /** Burdened per-mile deadhead cost (fuel + crew drive payroll). */
  deadhead_cost_per_mile: number;
  /** Flat long-haul prep for double-padding + shrink-wrap. */
  long_haul_prep_fee: number;
  /** Shuttle added when driveway-vision flags a restrictive address. */
  shuttle_fee: number | null;
  /** TV crating for each TV ≥ 65" that lacks an OEM box. */
  tv_crating_count: number;
  tv_crating_unit_fee: number;
  /** Specialty items (piano, safe, gym, etc.) with per-item fees. */
  specialty_fees: Array<{ label: string; fee: number }>;
  /** Contracted cu ft to set the overflow threshold. */
  contracted_cu_ft: number;
}

export interface LongDistanceComposition {
  line_items: LineItem[];
  binding: true;
  overflow_clause: string;
}

export function composeLongDistance(inputs: LongDistanceInputs): LongDistanceComposition {
  const lines: LineItem[] = [];

  const linehaul_total = round2(inputs.weight_lb * inputs.linehaul_rate_per_lb);
  lines.push({
    label: `Linehaul (${inputs.weight_lb.toLocaleString()} lbs @ $${inputs.linehaul_rate_per_lb.toFixed(2)}/lb)`,
    qty: inputs.weight_lb,
    unit_price: inputs.linehaul_rate_per_lb,
    total: linehaul_total,
    kind: "linehaul",
  });

  const fuel_total = round2(linehaul_total * inputs.fuel_surcharge_pct);
  lines.push({
    label: `Fuel surcharge (${(inputs.fuel_surcharge_pct * 100).toFixed(0)}% of linehaul)`,
    qty: 1,
    unit_price: fuel_total,
    total: fuel_total,
    kind: "fuel_surcharge",
  });

  if (inputs.deadhead_miles !== null && inputs.deadhead_miles > 0) {
    const deadhead_total = round2(inputs.deadhead_miles * inputs.deadhead_cost_per_mile);
    lines.push({
      label: `Origin travel / deadhead (${Math.round(inputs.deadhead_miles)} mi to origin)`,
      qty: Math.round(inputs.deadhead_miles),
      unit_price: inputs.deadhead_cost_per_mile,
      total: deadhead_total,
      kind: "deadhead",
    });
  }

  if (inputs.total_miles > 500 && inputs.long_haul_prep_fee > 0) {
    lines.push({
      label: "Long-haul prep (double-padding, shrink-wrap)",
      qty: 1,
      unit_price: inputs.long_haul_prep_fee,
      total: inputs.long_haul_prep_fee,
      kind: "long_haul_prep",
    });
  }

  if (inputs.shuttle_fee !== null && inputs.shuttle_fee > 0) {
    lines.push({
      label: "Shuttle service (restricted access)",
      qty: 1,
      unit_price: inputs.shuttle_fee,
      total: inputs.shuttle_fee,
      kind: "shuttle",
    });
  }

  if (inputs.tv_crating_count > 0 && inputs.tv_crating_unit_fee > 0) {
    const tv_total = round2(inputs.tv_crating_count * inputs.tv_crating_unit_fee);
    lines.push({
      label: `Oversized TV crating (${inputs.tv_crating_count} units)`,
      qty: inputs.tv_crating_count,
      unit_price: inputs.tv_crating_unit_fee,
      total: tv_total,
      kind: "crating",
    });
  }

  for (const s of inputs.specialty_fees) {
    lines.push({
      label: s.label,
      qty: 1,
      unit_price: s.fee,
      total: s.fee,
      kind: "other",
    });
  }

  // 15-C Item 85(4): the lawful mechanism for charges beyond this estimate
  // is a signed supplemental estimate, not an informal "$35/box" adder.
  const overflow_clause = `${SUPPLEMENTAL_CLAUSE_TEXT} This estimate reflects ${inputs.contracted_cu_ft.toLocaleString()} cu ft of contracted articles.`;
  lines.push({
    label: overflow_clause,
    qty: 0,
    unit_price: 0,
    total: 0,
    kind: "overflow_clause",
  });

  return { line_items: lines, binding: true, overflow_clause };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
