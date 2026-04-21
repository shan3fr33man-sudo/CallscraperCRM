// Tariff resolver: given a set of assignments + a context, pick the best-match tariff_id.

import type { TariffAssignment, TariffContext } from "./types";

/**
 * Scores an assignment against the context. Higher score = better match.
 * Each matching field adds to the score; the priority field is used as the
 * final tiebreaker (higher priority wins).
 */
function scoreAssignment(a: TariffAssignment, ctx: TariffContext): number {
  let score = 0;
  if (a.branch_id && ctx.branch_id && a.branch_id === ctx.branch_id) score += 4;
  if (a.service_type && ctx.service_type && a.service_type === ctx.service_type) score += 2;
  if (a.opportunity_type && ctx.opportunity_type && a.opportunity_type === ctx.opportunity_type) score += 1;
  // An assignment with no filters at all is a catch-all; keep it at score 0
  return score;
}

/** Returns the tariff_id of the best-match assignment, or null if no matches. */
export function resolveTariff(
  assignments: TariffAssignment[],
  ctx: TariffContext,
): string | null {
  if (!assignments || assignments.length === 0) return null;
  let best: { a: TariffAssignment; score: number } | null = null;
  for (const a of assignments) {
    const s = scoreAssignment(a, ctx);
    // An assignment that has a specific filter that doesn't match should NOT apply.
    // e.g. if assignment.branch_id is set but ctx.branch_id doesn't match, skip it.
    if (a.branch_id && ctx.branch_id && a.branch_id !== ctx.branch_id) continue;
    if (a.service_type && ctx.service_type && a.service_type !== ctx.service_type) continue;
    if (a.opportunity_type && ctx.opportunity_type && a.opportunity_type !== ctx.opportunity_type) continue;
    if (!best || s > best.score || (s === best.score && a.priority > best.a.priority)) {
      best = { a, score: s };
    }
  }
  return best?.a.tariff_id ?? null;
}
