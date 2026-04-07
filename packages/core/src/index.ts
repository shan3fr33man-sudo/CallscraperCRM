import { z } from "zod";

export const Contact = z.object({
  id: z.string().uuid().optional(),
  name: z.string(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  source: z.string().optional(),
});
export type Contact = z.infer<typeof Contact>;

export const Lead = z.object({
  id: z.string().uuid().optional(),
  contact_id: z.string().uuid().optional(),
  status: z.enum(["new", "qualified", "won", "lost"]).default("new"),
  score: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
});
export type Lead = z.infer<typeof Lead>;

export const Deal = z.object({
  id: z.string().uuid().optional(),
  name: z.string(),
  value: z.number().nonnegative().default(0),
  stage: z.string(),
  contact_id: z.string().uuid().optional(),
});
export type Deal = z.infer<typeof Deal>;

export const Call = z.object({
  id: z.string().uuid().optional(),
  external_id: z.string().optional(),
  from: z.string(),
  to: z.string().optional(),
  duration_seconds: z.number().int().nonnegative().optional(),
  recording_url: z.string().url().optional(),
  transcript: z.string().optional(),
  occurred_at: z.string().datetime().optional(),
});
export type Call = z.infer<typeof Call>;

export const SYSTEM_OBJECTS = ["contact", "lead", "deal", "call", "activity"] as const;
export type SystemObjectKey = (typeof SYSTEM_OBJECTS)[number];
