// Zod schemas for pricing engine inputs. Used by API routes for validation
// and by UI forms (e.g. the tariff live preview) to validate user input.

import { z } from "zod";

export const inventoryItemSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().int().min(1),
  weight_lbs: z.number().optional(),
  cubic_feet: z.number().optional(),
  is_heavy: z.boolean().optional(),
});

export const roomInventorySchema = z.object({
  room_name: z.string().min(1),
  items: z.array(inventoryItemSchema),
});

export const estimateInputSchema = z.object({
  move_type: z.string().min(1),
  move_size: z.string().nullable().optional(),
  origin: z.record(z.unknown()).nullable().optional(),
  destination: z.record(z.unknown()).nullable().optional(),
  service_date: z.string().nullable().optional(),
  crew_size: z.number().int().min(0).nullable().optional(),
  truck_count: z.number().int().min(0).nullable().optional(),
  estimated_hours: z.number().min(0).nullable().optional(),
  weight_lbs: z.number().min(0).nullable().optional(),
  distance_miles: z.number().min(0).nullable().optional(),
  rooms: z.array(roomInventorySchema).optional(),
  special_items: z.array(z.string()).optional(),
  floor_origin: z.number().int().min(1).nullable().optional(),
  floor_destination: z.number().int().min(1).nullable().optional(),
  elevator_origin: z.boolean().nullable().optional(),
  elevator_destination: z.boolean().nullable().optional(),
  long_carry_origin_ft: z.number().min(0).nullable().optional(),
  long_carry_destination_ft: z.number().min(0).nullable().optional(),
  packing_required: z.boolean().nullable().optional(),
  valuation_choice: z.string().nullable().optional(),
  declared_value: z.number().min(0).nullable().optional(),
});

export const pricingOptionsSchema = z.object({
  estimate_type: z.enum(["binding", "non_binding", "binding_nte", "hourly", "flat_rate"]).optional(),
  discount_pct: z.number().min(0).max(100).optional(),
  discount_flat: z.number().min(0).optional(),
  tax_rate: z.number().min(0).max(1).optional(),
});

export const previewRequestSchema = z.object({
  input: estimateInputSchema,
  options: pricingOptionsSchema.optional(),
});

export type PreviewRequest = z.infer<typeof previewRequestSchema>;
