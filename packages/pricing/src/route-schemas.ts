// Route-level Zod schemas for the tariff CRUD API. Imported by the Next.js
// route handlers so malformed requests never reach the database. These are
// stricter than the raw DB columns (enum strings are enforced, min_charge
// must be >= 0, etc.) and paired with helpful error messages.

import { z } from "zod";

// Match the DB CHECK constraints added in migration 0006
const RATE_KINDS = ["labor", "truck", "material", "packing", "travel", "flat", "mileage"] as const;
const RATE_UNITS = ["hour", "mile", "cwt", "flat", "each", "day"] as const;
const MODIFIER_KINDS = [
  "fuel_surcharge",
  "long_carry",
  "stairs",
  "heavy_item",
  "weekend",
  "holiday",
  "peak_season",
  "elevator",
  "shuttle",
] as const;
const FORMULA_TYPES = ["percentage", "flat", "per_flight", "per_100lbs", "per_item"] as const;
const COVERAGE_TYPES = ["released_value", "full_replacement", "lump_sum"] as const;
const ROUNDING_RULES = ["nearest_cent", "nearest_dollar", "ceil_dollar", "floor_dollar", "none"] as const;

// ─── Tariffs ───────────────────────────────────────────────────────

export const createTariffSchema = z.object({
  name: z.string().trim().min(1).max(200),
  branch_id: z.string().uuid().nullable().optional(),
  service_type: z.string().max(64).nullable().optional(),
  effective_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD").nullable().optional(),
  effective_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD").nullable().optional(),
  // ISO 4217 currency code format — three uppercase letters. Not an enum so
  // users can still set non-standard codes if needed, but rejects "123"-style
  // garbage that would break any downstream ledger integration.
  currency: z.string().regex(/^[A-Z]{3}$/, "must be a 3-letter ISO 4217 code").default("USD"),
  rounding_rule: z.enum(ROUNDING_RULES).default("nearest_cent"),
  is_default: z.boolean().default(false),
});

// Update schema without defaults so PATCH-ing only one field doesn't accidentally
// reset other columns. Every field is optional; fields that remain omitted are
// dropped before the DB update (see stripUndefined() caller in the route).
export const updateTariffSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    branch_id: z.string().uuid().nullable().optional(),
    service_type: z.string().max(64).nullable().optional(),
    effective_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    effective_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    currency: z.string().regex(/^[A-Z]{3}$/).optional(),
    rounding_rule: z.enum(ROUNDING_RULES).optional(),
    is_default: z.boolean().optional(),
    archived: z.boolean().optional(),
  })
  .strict();

// ─── Rates + tiers ─────────────────────────────────────────────────

export const createRateSchema = z.object({
  kind: z.enum(RATE_KINDS),
  label: z.string().max(200).nullable().optional(),
  base_rate: z.number().min(0),
  min_charge: z.number().min(0).default(0),
  unit: z.enum(RATE_UNITS),
  conditions_json: z.record(z.unknown()).default({}),
});

export const updateRateSchema = createRateSchema.partial();

export const createTierSchema = z.object({
  threshold: z.number().min(0),
  rate: z.number().min(0),
});

// ─── Modifiers ─────────────────────────────────────────────────────

const modifierConditionSchema = z
  .object({
    min_ft: z.number().min(0).optional(),
    holidays: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    start_month: z.number().int().min(1).max(12).optional(),
    end_month: z.number().int().min(1).max(12).optional(),
    applies: z.boolean().optional(),
  })
  .passthrough(); // allow future keys without breaking old clients

const formulaJsonSchema = z.object({
  type: z.enum(FORMULA_TYPES),
  value: z.number(),
  condition: modifierConditionSchema.optional(),
});

export const createModifierSchema = z.object({
  kind: z.enum(MODIFIER_KINDS),
  label: z.string().max(200).nullable().optional(),
  formula_json: formulaJsonSchema,
  stacking_order: z.number().int().min(0).default(100),
});

export const updateModifierSchema = createModifierSchema.partial();

// ─── Valuations ────────────────────────────────────────────────────

export const createValuationSchema = z.object({
  name: z.string().trim().min(1).max(200),
  coverage_type: z.enum(COVERAGE_TYPES),
  deductible: z.number().min(0).default(0),
  rate_per_thousand: z.number().min(0).default(0),
});

// ─── Handicaps ─────────────────────────────────────────────────────

const handicapConditionSchema = z
  .object({
    distance_min: z.number().min(0).optional(),
    distance_max: z.number().min(0).optional(),
    move_size: z.string().max(32).optional(),
    move_type: z.string().max(64).optional(),
  })
  .passthrough();

export const createHandicapSchema = z.object({
  name: z.string().trim().min(1).max(200),
  multiplier: z.number().min(0).max(10), // sanity: 0.5x discount or 10x surcharge at most
  condition_json: handicapConditionSchema.default({}),
});

// ─── Assignments ───────────────────────────────────────────────────

export const createAssignmentSchema = z.object({
  branch_id: z.string().uuid().nullable().optional(),
  opportunity_type: z.string().max(64).nullable().optional(),
  service_type: z.string().max(64).nullable().optional(),
  priority: z.number().int().default(0),
});

// ─── Type exports (inferred from schemas) ──────────────────────────

export type CreateTariffInput = z.infer<typeof createTariffSchema>;
export type UpdateTariffInput = z.infer<typeof updateTariffSchema>;
export type CreateRateInput = z.infer<typeof createRateSchema>;
export type UpdateRateInput = z.infer<typeof updateRateSchema>;
export type CreateTierInput = z.infer<typeof createTierSchema>;
export type CreateModifierInput = z.infer<typeof createModifierSchema>;
export type UpdateModifierInput = z.infer<typeof updateModifierSchema>;
export type CreateValuationInput = z.infer<typeof createValuationSchema>;
export type CreateHandicapInput = z.infer<typeof createHandicapSchema>;
export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;
