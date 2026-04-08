import type { SupabaseClient } from "@supabase/supabase-js";

export type EventType =
  | "customer.created"
  | "opportunity.created"
  | "opportunity.status_changed"
  | "opportunity.assigned"
  | "estimate.sent"
  | "estimate.accepted"
  | "estimate.declined"
  | "job.booked"
  | "job.confirmed"
  | "job.started"
  | "job.finished"
  | "job.rescheduled"
  | "task.created"
  | "task.due_soon"
  | "task.overdue"
  | "ticket.opened"
  | "ticket.closed"
  | "review.received"
  | "call.received"
  | "message.delivered"
  | "message.failed";

export interface EmitEventArgs {
  org_id: string;
  type: EventType | string;
  payload?: Record<string, unknown>;
  related_type?: string;
  related_id?: string;
}

/** Insert a single event row. Returns the new event id. */
export async function emitEvent(
  supabase: SupabaseClient,
  args: EmitEventArgs
): Promise<string> {
  const { data, error } = await supabase
    .from("events")
    .insert({
      org_id: args.org_id,
      type: args.type,
      payload: args.payload ?? {},
      related_type: args.related_type ?? null,
      related_id: args.related_id ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(`emitEvent failed: ${error.message}`);
  return data!.id as string;
}
