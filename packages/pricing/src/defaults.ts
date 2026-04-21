// Seed data for default tariffs used to populate newly-created orgs.
// These match the SQL seeds in packages/db/migrations/0005_tariff_seeds_and_invoices.sql
// but are exported here for browser preview / client-side defaulting.

import type { FullTariff } from "./types";

/** Pacific NW / Seattle local-move rates for A Perfect Mover brand. */
export function getDefaultAPMTariff(orgId: string): FullTariff {
  const id = "t-apm-default";
  return {
    id,
    org_id: orgId,
    name: "APM Standard Local",
    branch_id: null,
    service_type: "local_move",
    effective_from: "2026-01-01",
    effective_to: null,
    currency: "USD",
    rounding_rule: "nearest_cent",
    is_default: true,
    archived: false,
    rates: [
      {
        id: "r-apm-labor",
        tariff_id: id,
        kind: "labor",
        label: "Mover (per hour)",
        base_rate: 175,
        min_charge: 525, // 3-hour minimum at 1 mover
        unit: "hour",
        conditions_json: {},
      },
      {
        id: "r-apm-truck",
        tariff_id: id,
        kind: "truck",
        label: "Truck (per hour)",
        base_rate: 125,
        min_charge: 250,
        unit: "hour",
        conditions_json: {},
      },
      {
        id: "r-apm-travel",
        tariff_id: id,
        kind: "travel",
        label: "Travel fee",
        base_rate: 150,
        min_charge: 0,
        unit: "flat",
        conditions_json: {},
      },
      {
        id: "r-apm-mileage",
        tariff_id: id,
        kind: "mileage",
        label: "Long-distance mileage",
        base_rate: 4.5,
        min_charge: 0,
        unit: "mile",
        conditions_json: {},
      },
    ],
    modifiers: [
      {
        id: "m-apm-fuel",
        tariff_id: id,
        kind: "fuel_surcharge",
        label: "Fuel surcharge",
        formula_json: { type: "percentage", value: 8 },
        stacking_order: 10,
      },
      {
        id: "m-apm-stairs",
        tariff_id: id,
        kind: "stairs",
        label: "Stairs",
        formula_json: { type: "per_flight", value: 75 },
        stacking_order: 20,
      },
      {
        id: "m-apm-longcarry",
        tariff_id: id,
        kind: "long_carry",
        label: "Long carry",
        formula_json: { type: "flat", value: 100, condition: { min_ft: 75 } },
        stacking_order: 30,
      },
      {
        id: "m-apm-weekend",
        tariff_id: id,
        kind: "weekend",
        label: "Weekend",
        formula_json: { type: "percentage", value: 15 },
        stacking_order: 5,
      },
      {
        id: "m-apm-heavy",
        tariff_id: id,
        kind: "heavy_item",
        label: "Heavy item",
        formula_json: { type: "per_item", value: 50 },
        stacking_order: 40,
      },
    ],
    valuations: [
      {
        id: "v-apm-released",
        tariff_id: id,
        name: "Released Value",
        coverage_type: "released_value",
        deductible: 0,
        rate_per_thousand: 0.6,
      },
      {
        id: "v-apm-fullrep",
        tariff_id: id,
        name: "Full Replacement",
        coverage_type: "full_replacement",
        deductible: 250,
        rate_per_thousand: 25,
      },
    ],
    handicaps: [],
    assignments: [],
  };
}

/** Lower-tier brand (Affordable Movers / AFM). */
export function getDefaultAFMTariff(orgId: string): FullTariff {
  const id = "t-afm-default";
  return {
    id,
    org_id: orgId,
    name: "AFM Budget Local",
    branch_id: null,
    service_type: "local_move",
    effective_from: "2026-01-01",
    effective_to: null,
    currency: "USD",
    rounding_rule: "nearest_cent",
    is_default: false,
    archived: false,
    rates: [
      {
        id: "r-afm-labor",
        tariff_id: id,
        kind: "labor",
        label: "Mover (per hour)",
        base_rate: 135,
        min_charge: 405,
        unit: "hour",
        conditions_json: {},
      },
      {
        id: "r-afm-truck",
        tariff_id: id,
        kind: "truck",
        label: "Truck (per hour)",
        base_rate: 95,
        min_charge: 190,
        unit: "hour",
        conditions_json: {},
      },
      {
        id: "r-afm-travel",
        tariff_id: id,
        kind: "travel",
        label: "Travel fee",
        base_rate: 100,
        min_charge: 0,
        unit: "flat",
        conditions_json: {},
      },
    ],
    modifiers: [
      {
        id: "m-afm-fuel",
        tariff_id: id,
        kind: "fuel_surcharge",
        label: "Fuel surcharge",
        formula_json: { type: "percentage", value: 6 },
        stacking_order: 10,
      },
      {
        id: "m-afm-stairs",
        tariff_id: id,
        kind: "stairs",
        label: "Stairs",
        formula_json: { type: "per_flight", value: 50 },
        stacking_order: 20,
      },
      {
        id: "m-afm-weekend",
        tariff_id: id,
        kind: "weekend",
        label: "Weekend",
        formula_json: { type: "percentage", value: 10 },
        stacking_order: 5,
      },
    ],
    valuations: [
      {
        id: "v-afm-released",
        tariff_id: id,
        name: "Released Value",
        coverage_type: "released_value",
        deductible: 0,
        rate_per_thousand: 0.6,
      },
    ],
    handicaps: [],
    assignments: [],
  };
}
