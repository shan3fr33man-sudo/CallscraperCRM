import type { MarginResult, PricingMode } from "./types";

/**
 * Margin protection check.
 *
 * Blocks auto-insert if gross margin falls below the min policy for this
 * move class. Warns (but permits auto-insert) if margin is between min and
 * target. Green if at/above target.
 *
 * `estimated_direct_cost` should include: crew-hours × burdened rate + fuel
 * + hotel/per-diem (long-distance) + deadhead payroll + truck wear. Caller
 * (predict.ts) does the math; this module just compares.
 */
export interface MarginPolicy {
  move_class: PricingMode;
  min_margin_pct: number;
  target_margin_pct: number;
}

export function checkMargin(args: {
  estimated_revenue: number;
  estimated_direct_cost: number;
  policy: MarginPolicy;
}): MarginResult {
  const { estimated_revenue, estimated_direct_cost, policy } = args;
  if (estimated_revenue <= 0) {
    return {
      status: "block",
      reason: "Revenue is zero or negative",
      gross_margin_pct: 0,
      estimated_revenue,
      estimated_direct_cost,
    };
  }

  const gross = estimated_revenue - estimated_direct_cost;
  const marginPct = (gross / estimated_revenue) * 100;

  if (marginPct < policy.min_margin_pct) {
    return {
      status: "block",
      reason: `Gross margin ${marginPct.toFixed(1)}% is below minimum ${policy.min_margin_pct}% for ${policy.move_class}. Agent review required.`,
      gross_margin_pct: marginPct,
      estimated_revenue,
      estimated_direct_cost,
    };
  }
  if (marginPct < policy.target_margin_pct) {
    return {
      status: "warn",
      reason: `Gross margin ${marginPct.toFixed(1)}% is below target ${policy.target_margin_pct}% for ${policy.move_class}. Consider reviewing pricing.`,
      gross_margin_pct: marginPct,
      estimated_revenue,
      estimated_direct_cost,
    };
  }
  return {
    status: "ok",
    gross_margin_pct: marginPct,
    estimated_revenue,
    estimated_direct_cost,
  };
}
