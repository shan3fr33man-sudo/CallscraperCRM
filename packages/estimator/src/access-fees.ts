/**
 * Tariff 15-C Items 160 & 165 — access/logistics charges.
 *
 * Item 160 — Long-carry: beyond first 75 ft between vehicle and door, per
 *   each 50 ft (or fraction), per 100 lb:        $0.69 min  / $2.53 max
 * Item 165 — Stairs: per flight, per 100 lb:      $0.69 min  / $2.53 max
 * Item 165 — Elevator: per 100 lb (one-time):     $1.04 min  / $3.77 max
 *
 * "If both stairs and an elevator are available, charges will be based on
 * the calculation that provides the lower cost to the customer."
 *
 * These apply once at origin AND once at destination if both have the
 * relevant feature. Most customers only describe one side during the call;
 * this module takes a single `access` input and applies it once — the agent
 * can duplicate for the other side in the CRM UI if needed.
 */
import { ACCESS_CHARGES_PER_100LB } from "./tariff-15c";
import type { LineItem } from "./types";

export interface AccessInputs {
  stairs?: number;           // flight count
  elevator?: boolean;
  long_carry_ft?: number;    // feet between vehicle and door
  weight_lb: number;
}

/**
 * Compose access-fee line items. Uses tariff MIDPOINT per $100 lb per unit;
 * carrier-filed rates will override once a filed-rates table is wired in.
 */
export function composeAccessFees(access: AccessInputs): LineItem[] {
  const lines: LineItem[] = [];
  if (!access.weight_lb || access.weight_lb <= 0) return lines;
  const per100 = access.weight_lb / 100;

  if (access.long_carry_ft && access.long_carry_ft > 75) {
    const extraFt = access.long_carry_ft - 75;
    const units = Math.ceil(extraFt / 50);
    const midRate =
      (ACCESS_CHARGES_PER_100LB.LONG_CARRY_PER_50FT.min +
        ACCESS_CHARGES_PER_100LB.LONG_CARRY_PER_50FT.max) /
      2;
    const total = round2(units * per100 * midRate);
    lines.push({
      label: `Long carry — ${extraFt} ft past first 75 ft (15-C Item 160, ${units} × 50-ft units × ${per100.toFixed(1)} hundredweight)`,
      qty: units,
      unit_price: round2(per100 * midRate),
      total,
      kind: "other",
    });
  }

  const stairsCharge =
    access.stairs && access.stairs > 0
      ? round2(
          access.stairs *
            per100 *
            ((ACCESS_CHARGES_PER_100LB.STAIRS_PER_FLIGHT.min +
              ACCESS_CHARGES_PER_100LB.STAIRS_PER_FLIGHT.max) /
              2),
        )
      : 0;
  const elevatorCharge = access.elevator
    ? round2(
        per100 *
          ((ACCESS_CHARGES_PER_100LB.ELEVATOR.min + ACCESS_CHARGES_PER_100LB.ELEVATOR.max) / 2),
      )
    : 0;

  // 15-C: "If both stairs and an elevator are available, charges will be
  // based on the calculation that provides the lower cost to the customer."
  if (stairsCharge > 0 && elevatorCharge > 0) {
    if (elevatorCharge < stairsCharge) {
      lines.push({
        label: `Elevator charge (15-C Item 165; cheaper than ${access.stairs} flights of stairs)`,
        qty: 1,
        unit_price: elevatorCharge,
        total: elevatorCharge,
        kind: "other",
      });
    } else {
      lines.push({
        label: `Stairs — ${access.stairs} flights (15-C Item 165; cheaper than elevator)`,
        qty: access.stairs ?? 1,
        unit_price: round2(stairsCharge / (access.stairs ?? 1)),
        total: stairsCharge,
        kind: "other",
      });
    }
  } else if (stairsCharge > 0) {
    lines.push({
      label: `Stairs — ${access.stairs} flights (15-C Item 165)`,
      qty: access.stairs ?? 1,
      unit_price: round2(stairsCharge / (access.stairs ?? 1)),
      total: stairsCharge,
      kind: "other",
    });
  } else if (elevatorCharge > 0) {
    lines.push({
      label: "Elevator charge (15-C Item 165)",
      qty: 1,
      unit_price: elevatorCharge,
      total: elevatorCharge,
      kind: "other",
    });
  }

  return lines;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
