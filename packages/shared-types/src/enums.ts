// Locked vocabulary — sourced from upstream callscraper.com Supabase project earddtfueyboluglwbgt.
// Do not rename. Do not alias. CI vocab check enforces these names.

export const BRANDS = ["APM", "AFM", "crewready", "apex", "other"] as const;
export type Brand = (typeof BRANDS)[number];

export const CALL_DIRECTIONS = ["inbound", "outbound"] as const;
export type CallDirection = (typeof CALL_DIRECTIONS)[number];

// `intent` and `sentiment` are stored as free text upstream — we mirror that.
// Common values surfaced via grouping; treat as hints, not constraints.
export const INTENT_HINTS = [
  "General inquiry",
  "Customer undecided",
  "Voicemail",
  "Job booked",
  "Quote given",
  "Quote pending",
  "Estimate scheduled",
  "Onsite estimate scheduled",
  "Rescheduling",
  "Cancellation",
  "Complaint",
  "Unknown",
] as const;

export const LEAD_QUALITIES = ["hot", "warm", "cold", "unknown"] as const;
export type LeadQuality = (typeof LEAD_QUALITIES)[number];

export const OPPORTUNITY_STATUSES = [
  "new",
  "contacted",
  "quoted",
  "booked",
  "completed",
  "lost",
  "cancelled",
] as const;
export type OpportunityStatus = (typeof OPPORTUNITY_STATUSES)[number];

export const JOB_STATUSES = [
  "booked",
  "confirmed",
  "en_route",
  "in_progress",
  "finished",
  "pending_finalize",
  "pending_close",
  "closed",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const TASK_STATUSES = ["not_started", "in_progress", "completed"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TICKET_STATUSES = ["active", "completed"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const CALENDAR_KINDS = ["office", "job"] as const;
export type CalendarKind = (typeof CALENDAR_KINDS)[number];

export const OFFICE_EVENT_TYPES = [
  "on_site_estimate",
  "virtual_survey",
  "phone_survey",
  "box_delivery",
  "liveswitch_survey",
  "other",
] as const;
export type OfficeEventType = (typeof OFFICE_EVENT_TYPES)[number];

export const ACTIVITY_KINDS = ["call", "summary", "note", "email", "sms", "system"] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

// ─── Banned aliases (used by scripts/check-vocab.ts) ───────────────────
// Any of these in the codebase fails CI. Replacements in parens.
export const BANNED_VOCAB: Record<string, string> = {
  phone_number: "customer_phone | from_number | to_number",
  phoneNumber: "customerPhone | fromNumber | toNumber",
  full_name: "customer_name | display_name",
  fullName: "customerName | displayName",
  email_address: "customer_email",
  emailAddress: "customerEmail",
  estimated_value: "amount",
  estimatedValue: "amount",
  opp_status: "status (on opportunities)",
  oppStatus: "status",
  job_number: "quote_number",
  jobNumber: "quoteNumber",
  assignee_id: "assigned_to",
  assigneeId: "assignedTo",
};
