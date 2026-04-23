/**
 * Zod schemas for SmartMoving Premium API responses.
 *
 * These mirror the fields the estimator consumes. The API returns a wider
 * surface than we model here; we `.passthrough()` unknown keys so an upstream
 * shape change doesn't break schema validation, but we only type the parts we
 * use. If SmartMoving adds a field we care about later, add it to the schema.
 *
 * NOTE: field names below follow what callscraper.com v3 uses for the same
 * endpoints (see memory: `/premium/opportunities/{id}/...`). When we receive
 * real payloads during the first smoke test, we'll confirm exact casing and
 * adjust.
 */
import { z } from "zod";

export const moveCategorySchema = z.enum([
  "single_item",
  "1br",
  "2br",
  "3br",
  "condo",
  "apartment",
  "townhouse",
  "commercial",
]);
export type MoveCategory = z.infer<typeof moveCategorySchema>;

export const moveCategories: MoveCategory[] = [
  "single_item",
  "1br",
  "2br",
  "3br",
  "condo",
  "apartment",
  "townhouse",
  "commercial",
];

/** Materials block as SmartMoving returns it; we normalize to keyed SKUs later. */
export const materialLineSchema = z
  .object({
    sku: z.string().optional(),
    name: z.string().optional(),
    qty: z.number().nullable().optional(),
    unit_price: z.number().nullable().optional(),
    total: z.number().nullable().optional(),
  })
  .passthrough();

export const accessDetailsSchema = z
  .object({
    stairs: z.number().int().nullable().optional(),
    elevator: z.boolean().nullable().optional(),
    long_carry: z.boolean().nullable().optional(),
    specialty_items: z.array(z.string()).optional(),
  })
  .passthrough();

export const inventoryRoomSchema = z
  .object({
    room: z.string(),
    level: z.string().optional(),
    items: z
      .array(
        z
          .object({
            name: z.string(),
            qty: z.number().nullable().optional(),
            lwh_ft: z.string().nullable().optional(),
            disassemble: z.boolean().optional(),
          })
          .passthrough(),
      )
      .optional(),
  })
  .passthrough();

/** Branch / office identifier embedded in opportunity payloads. Different
 *  SmartMoving tenants use slightly different names, so we accept all of
 *  `branch`, `office`, or `branchName` as loose passthrough keys. */
export const branchInfoSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().optional(),
  })
  .passthrough();

export const opportunityListItemSchema = z
  .object({
    id: z.string(),
    status: z.string().optional(),
    move_size: z.string().nullable().optional(),
    service_date: z.string().nullable().optional(),
    created_at: z.string().optional(),
    branch: branchInfoSchema.optional(),
    office: branchInfoSchema.optional(),
    branchName: z.string().optional(),
  })
  .passthrough();

/** Full opportunity detail — what we store in historical_jobs.raw_payload. */
export const opportunityDetailSchema = z
  .object({
    id: z.string(),
    status: z.string().optional(),
    move_size: z.string().nullable().optional(),
    service_date: z.string().nullable().optional(),

    // Addresses
    origin: z
      .object({
        zip: z.string().nullable().optional(),
        state: z.string().nullable().optional(),
      })
      .passthrough()
      .optional(),
    destination: z
      .object({
        zip: z.string().nullable().optional(),
        state: z.string().nullable().optional(),
      })
      .passthrough()
      .optional(),

    // Crew / truck / time
    crew_size: z.number().nullable().optional(),
    truck_size: z.string().nullable().optional(),
    billed_hours: z.number().nullable().optional(),

    // Distance / weight / volume
    total_miles: z.number().nullable().optional(),
    total_weight_lb: z.number().nullable().optional(),
    total_cu_ft: z.number().nullable().optional(),

    // Money
    total_amount: z.number().nullable().optional(),
    linehaul_rate_per_lb: z.number().nullable().optional(),
    fuel_surcharge_pct: z.number().nullable().optional(),
    deadhead_miles: z.number().nullable().optional(),
    shuttle_fee: z.number().nullable().optional(),
    long_haul_prep_fee: z.number().nullable().optional(),
    crating_fees: z.number().nullable().optional(),

    // Materials + valuation
    materials: z.array(materialLineSchema).optional(),
    valuation_type: z.enum(["basic", "full"]).nullable().optional(),
    declared_value: z.number().nullable().optional(),

    // Access + inventory
    access: accessDetailsSchema.optional(),
    inventory: z.array(inventoryRoomSchema).optional(),
  })
  .passthrough();

export type OpportunityDetail = z.infer<typeof opportunityDetailSchema>;

export const listResponseSchema = z
  .object({
    items: z.array(opportunityListItemSchema),
    total: z.number().optional(),
    offset: z.number().optional(),
    limit: z.number().optional(),
  })
  .passthrough();
