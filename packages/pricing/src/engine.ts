// Pure pricing engine. No DB calls, no network — runs in Node (API routes, worker)
// and in the browser (live preview panel). Takes a fully-loaded tariff and an
// EstimateInput, returns a deterministic PricingResult.

import type {
  FullTariff,
  EstimateInput,
  PricingResult,
  PricingOptions,
  PricingLineItem,
  AppliedModifier,
  AppliedHandicap,
  TariffRate,
  TariffTier,
  TariffModifier,
  TariffValuation,
} from "./types";

function roundAmount(n: number, rule: string): number {
  switch (rule) {
    case "nearest_dollar":
      return Math.round(n);
    case "ceil_dollar":
      return Math.ceil(n);
    case "floor_dollar":
      return Math.floor(n);
    case "none":
      return n;
    case "nearest_cent":
    default:
      return Math.round(n * 100) / 100;
  }
}

/** Compute quantity consumed by a rate given the input (crew×hours for labor, trucks×hours for truck, etc.). */
function quantityFor(rate: TariffRate, input: EstimateInput): number {
  const hours = input.estimated_hours ?? 0;
  const crew = input.crew_size ?? 0;
  const trucks = input.truck_count ?? 0;
  const miles = input.distance_miles ?? 0;
  const weight = input.weight_lbs ?? 0;

  switch (rate.kind) {
    case "labor":
      return rate.unit === "hour" ? hours * Math.max(crew, 1) : 1;
    case "truck":
      return rate.unit === "hour" ? hours * Math.max(trucks, 1) : Math.max(trucks, 1);
    case "mileage":
      return miles;
    case "packing":
      return rate.unit === "hour" ? hours : 1;
    case "material":
      return 1; // flat material charge; could be extended with material count
    case "travel":
    case "flat":
      return 1;
    default:
      return 1;
  }
}

/** Apply tiered pricing: given sorted tiers by threshold, compute per-unit rate for a given quantity. */
function applyTiers(baseRate: number, quantity: number, tiers?: TariffTier[]): number {
  if (!tiers || tiers.length === 0) return baseRate * quantity;
  const sorted = [...tiers].sort((a, b) => a.threshold - b.threshold);
  let total = 0;
  let remaining = quantity;
  let currentRate = baseRate;
  let prevThreshold = 0;
  for (const tier of sorted) {
    if (remaining <= 0) break;
    const slice = Math.min(remaining, tier.threshold - prevThreshold);
    if (slice > 0) {
      total += slice * currentRate;
      remaining -= slice;
    }
    currentRate = tier.rate;
    prevThreshold = tier.threshold;
  }
  if (remaining > 0) total += remaining * currentRate;
  return total;
}

function isWeekend(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}

function isHoliday(dateStr?: string | null, holidays?: string[]): boolean {
  if (!dateStr || !holidays) return false;
  const md = dateStr.slice(5); // MM-DD
  return holidays.some((h) => h.slice(5) === md);
}

function evalModifierCondition(mod: TariffModifier, input: EstimateInput): boolean {
  switch (mod.kind) {
    case "weekend":
      return isWeekend(input.service_date);
    case "holiday": {
      const holidays = Array.isArray(mod.formula_json.condition?.holidays)
        ? (mod.formula_json.condition!.holidays as string[])
        : [];
      return isHoliday(input.service_date, holidays);
    }
    case "peak_season": {
      if (!input.service_date) return false;
      const d = new Date(input.service_date);
      if (isNaN(d.getTime())) return false;
      const month = d.getUTCMonth() + 1;
      const cond = mod.formula_json.condition as { start_month?: number; end_month?: number } | undefined;
      const start = cond?.start_month ?? 5; // May
      const end = cond?.end_month ?? 9; // Sep
      return month >= start && month <= end;
    }
    case "stairs": {
      const flights =
        Math.max(0, (input.floor_origin ?? 1) - 1) +
        Math.max(0, (input.floor_destination ?? 1) - 1);
      return flights > 0 && !(input.elevator_origin && input.elevator_destination);
    }
    case "long_carry": {
      const ft = (input.long_carry_origin_ft ?? 0) + (input.long_carry_destination_ft ?? 0);
      const threshold = (mod.formula_json.condition as { min_ft?: number } | undefined)?.min_ft ?? 75;
      return ft >= threshold;
    }
    case "heavy_item": {
      const heavyCount =
        (input.rooms ?? []).reduce(
          (acc, r) => acc + r.items.filter((i) => i.is_heavy).reduce((s, i) => s + i.quantity, 0),
          0,
        ) + (input.special_items?.length ?? 0);
      return heavyCount > 0;
    }
    case "elevator":
      return Boolean(input.elevator_origin || input.elevator_destination);
    case "shuttle":
      return Boolean((mod.formula_json.condition as { applies?: boolean } | undefined)?.applies);
    case "fuel_surcharge":
      return true; // always applies
    default:
      return true;
  }
}

function modifierAmount(
  mod: TariffModifier,
  base: number,
  input: EstimateInput,
): { amount: number; applied_to: string } {
  const f = mod.formula_json;
  switch (f.type) {
    case "percentage":
      return { amount: base * (f.value / 100), applied_to: "labor+truck" };
    case "flat":
      return { amount: f.value, applied_to: "flat" };
    case "per_flight": {
      const flights =
        Math.max(0, (input.floor_origin ?? 1) - 1) +
        Math.max(0, (input.floor_destination ?? 1) - 1);
      return { amount: f.value * flights, applied_to: `${flights} flight(s)` };
    }
    case "per_100lbs": {
      const w = input.weight_lbs ?? 0;
      return { amount: f.value * (w / 100), applied_to: `${w} lbs` };
    }
    case "per_item": {
      const heavyCount =
        (input.rooms ?? []).reduce(
          (acc, r) => acc + r.items.filter((i) => i.is_heavy).reduce((s, i) => s + i.quantity, 0),
          0,
        ) + (input.special_items?.length ?? 0);
      return { amount: f.value * heavyCount, applied_to: `${heavyCount} heavy item(s)` };
    }
    default:
      return { amount: 0, applied_to: "none" };
  }
}

function valuationCharge(
  val: TariffValuation | null,
  input: EstimateInput,
): number {
  if (!val) return 0;
  switch (val.coverage_type) {
    case "released_value":
      // $0.60/lb default rate_per_thousand interpreted as cents per lb here
      return (input.weight_lbs ?? 0) * val.rate_per_thousand;
    case "full_replacement": {
      const declared = input.declared_value ?? 0;
      return (declared / 1000) * val.rate_per_thousand;
    }
    case "lump_sum":
      return val.rate_per_thousand; // lump sum stored in rate_per_thousand field
    default:
      return 0;
  }
}

function pickValuation(tariff: FullTariff, input: EstimateInput): TariffValuation | null {
  if (!input.valuation_choice) return null;
  return tariff.valuations.find((v) => v.name === input.valuation_choice) ?? null;
}

function evalHandicapCondition(cond: Record<string, unknown>, input: EstimateInput): boolean {
  // Simple matcher: { distance_min, distance_max, move_size, move_type }
  const distMin = cond.distance_min as number | undefined;
  const distMax = cond.distance_max as number | undefined;
  const miles = input.distance_miles ?? 0;
  if (distMin !== undefined && miles < distMin) return false;
  if (distMax !== undefined && miles > distMax) return false;
  if (cond.move_size && input.move_size !== cond.move_size) return false;
  if (cond.move_type && input.move_type !== cond.move_type) return false;
  return true;
}

export function calculateEstimate(
  tariff: FullTariff,
  input: EstimateInput,
  options: PricingOptions = {},
): PricingResult {
  const trace: string[] = [];
  const rule = tariff.rounding_rule ?? "nearest_cent";
  const estimateType = options.estimate_type ?? "non_binding";

  // ─── 1. Base rates → line items ────────────────────────────────────
  const lineItems: PricingLineItem[] = [];
  for (const rate of tariff.rates) {
    const qty = quantityFor(rate, input);
    if (qty <= 0) continue;
    let amount = applyTiers(rate.base_rate, qty, rate.tiers);
    if (rate.min_charge && amount < rate.min_charge) {
      trace.push(`Applied min charge for ${rate.label ?? rate.kind}: $${rate.min_charge}`);
      amount = rate.min_charge;
    }
    amount = roundAmount(amount, rule);
    lineItems.push({
      rate_id: rate.id,
      label: rate.label ?? rate.kind,
      kind: rate.kind,
      rate: rate.base_rate,
      quantity: qty,
      unit: rate.unit,
      subtotal: amount,
    });
  }

  const subtotal = roundAmount(
    lineItems.reduce((s, li) => s + li.subtotal, 0),
    rule,
  );
  trace.push(`Subtotal (sum of line items): $${subtotal.toFixed(2)}`);

  // ─── 2. Modifiers (in stacking_order) ──────────────────────────────
  const laborTruckBase = lineItems
    .filter((li) => li.kind === "labor" || li.kind === "truck")
    .reduce((s, li) => s + li.subtotal, 0);

  const modifiers_applied: AppliedModifier[] = [];
  const sortedMods = [...tariff.modifiers].sort((a, b) => a.stacking_order - b.stacking_order);
  for (const mod of sortedMods) {
    if (!evalModifierCondition(mod, input)) continue;
    const base = mod.formula_json.type === "percentage" ? laborTruckBase : subtotal;
    const { amount, applied_to } = modifierAmount(mod, base, input);
    if (amount <= 0) continue;
    const rounded = roundAmount(amount, rule);
    modifiers_applied.push({
      modifier_id: mod.id,
      label: mod.label ?? mod.kind,
      kind: mod.kind,
      amount: rounded,
      formula: mod.formula_json,
      applied_to,
    });
    trace.push(`${mod.kind} modifier: +$${rounded.toFixed(2)} (${applied_to})`);
  }
  const modifiers_total = roundAmount(
    modifiers_applied.reduce((s, m) => s + m.amount, 0),
    rule,
  );

  // ─── 3. Handicaps (multipliers on subtotal) ─────────────────────────
  const handicaps_applied: AppliedHandicap[] = [];
  for (const h of tariff.handicaps) {
    if (!evalHandicapCondition(h.condition_json ?? {}, input)) continue;
    const delta = roundAmount(subtotal * (h.multiplier - 1), rule);
    if (Math.abs(delta) < 0.01) continue;
    handicaps_applied.push({
      handicap_id: h.id,
      name: h.name,
      multiplier: h.multiplier,
      amount: delta,
    });
    trace.push(`Handicap "${h.name}" x${h.multiplier}: +$${delta.toFixed(2)}`);
  }
  const handicaps_total = roundAmount(
    handicaps_applied.reduce((s, h) => s + h.amount, 0),
    rule,
  );

  // ─── 4. Valuation charge ────────────────────────────────────────────
  const chosenVal = pickValuation(tariff, input);
  const valuation_charge = roundAmount(valuationCharge(chosenVal, input), rule);
  if (valuation_charge > 0) {
    trace.push(`Valuation (${chosenVal?.name}): +$${valuation_charge.toFixed(2)}`);
  }

  // ─── 5. Totals → discount → tax ─────────────────────────────────────
  const pre_discount_total = roundAmount(
    subtotal + modifiers_total + handicaps_total + valuation_charge,
    rule,
  );

  let discount = 0;
  if (options.discount_flat && options.discount_flat > 0) discount += options.discount_flat;
  if (options.discount_pct && options.discount_pct > 0) {
    discount += pre_discount_total * (options.discount_pct / 100);
  }
  discount = roundAmount(discount, rule);
  if (discount > 0) trace.push(`Discount: -$${discount.toFixed(2)}`);

  const taxable_amount = roundAmount(Math.max(0, pre_discount_total - discount), rule);
  const taxRate = options.tax_rate ?? 0;
  const sales_tax = roundAmount(taxable_amount * taxRate, rule);
  if (sales_tax > 0) trace.push(`Sales tax (${(taxRate * 100).toFixed(2)}%): +$${sales_tax.toFixed(2)}`);

  const total = roundAmount(taxable_amount + sales_tax, rule);
  trace.push(`Total: $${total.toFixed(2)}`);

  return {
    line_items: lineItems,
    subtotal,
    modifiers_applied,
    modifiers_total,
    handicaps_applied,
    handicaps_total,
    valuation_charge,
    pre_discount_total,
    discount,
    taxable_amount,
    sales_tax,
    total,
    tariff_id: tariff.id,
    tariff_snapshot: tariff,
    estimate_type: estimateType,
    trace,
  };
}
