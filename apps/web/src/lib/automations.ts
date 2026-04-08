import type { SupabaseClient } from "@supabase/supabase-js";
import { emitEvent } from "./events";

export type ActionType =
  | "send_template"
  | "create_task"
  | "create_calendar_event"
  | "set_status"
  | "assign_owner"
  | "create_ticket"
  | "webhook";

export interface Action {
  type: ActionType;
  params: Record<string, unknown>;
}

interface AutomationRow {
  id: string;
  org_id: string;
  name: string;
  trigger: string;
  conditions_json: Record<string, unknown> | null;
  actions_json: Action[] | null;
  enabled: boolean;
}

interface EventRow {
  id: string;
  org_id: string;
  type: string;
  payload: Record<string, unknown>;
  related_type: string | null;
  related_id: string | null;
  created_at: string;
}

interface RunResult {
  processed: number;
  ran: number;
  failed: number;
}

/** Resolve {{path.to.value}} placeholders against a context object. */
function interpolate(template: string, ctx: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path: string) => {
    const parts = path.split(".");
    let v: unknown = ctx;
    for (const p of parts) {
      if (v && typeof v === "object" && p in (v as Record<string, unknown>)) {
        v = (v as Record<string, unknown>)[p];
      } else {
        return "";
      }
    }
    return v == null ? "" : String(v);
  });
}

function addHours(iso: string | Date | undefined, hours: number): string {
  const base = iso ? new Date(iso) : new Date();
  return new Date(base.getTime() + hours * 3600_000).toISOString();
}

async function runAction(
  supabase: SupabaseClient,
  ev: EventRow,
  action: Action
): Promise<void> {
  const ctx = { event: ev, payload: ev.payload };
  const p = action.params;

  switch (action.type) {
    case "create_task": {
      const dueHours = (p.due_in_hours as number) ?? 24;
      const title = interpolate((p.title as string) ?? "Follow up", ctx);
      await supabase.from("tasks").insert({
        org_id: ev.org_id,
        title,
        body: interpolate((p.body as string) ?? "", ctx),
        due_at: addHours(undefined, dueHours),
        type: (p.type as string) ?? "follow_up",
        priority: (p.priority as number) ?? 3,
        related_type: ev.related_type,
        related_id: ev.related_id,
      });
      await emitEvent(supabase, {
        org_id: ev.org_id,
        type: "task.created",
        related_type: ev.related_type ?? undefined,
        related_id: ev.related_id ?? undefined,
        payload: { title, source_event: ev.id },
      });
      return;
    }
    case "create_calendar_event": {
      const startsAt = (p.starts_at as string) ?? new Date().toISOString();
      const durationH = (p.duration_hours as number) ?? 1;
      await supabase.from("calendar_events").insert({
        org_id: ev.org_id,
        kind: (p.kind as string) ?? "office",
        event_type: (p.event_type as string) ?? "other",
        title: interpolate((p.title as string) ?? "Event", ctx),
        starts_at: startsAt,
        ends_at: addHours(startsAt, durationH),
        related_type: ev.related_type,
        related_id: ev.related_id,
      });
      return;
    }
    case "send_template": {
      const channel = (p.channel as string) ?? "sms";
      const templateKey = p.template_key as string;
      // Resolve template body
      let body = (p.body as string) ?? "";
      if (templateKey) {
        const { data: tpl } = await supabase
          .from("templates")
          .select("body,subject")
          .eq("org_id", ev.org_id)
          .eq("key", templateKey)
          .maybeSingle();
        if (tpl?.body) body = tpl.body;
      }
      const rendered = interpolate(body, ctx);
      const customerId = (ev.payload.customer_id as string) ?? null;
      if (channel === "sms") {
        await supabase.from("sms_logs").insert({
          org_id: ev.org_id,
          customer_id: customerId,
          to_number: (ev.payload.customer_phone as string) ?? null,
          message: rendered,
          status: "queued",
          template_key: templateKey ?? null,
          related_type: ev.related_type,
          related_id: ev.related_id,
        });
      } else {
        await supabase.from("email_logs").insert({
          org_id: ev.org_id,
          customer_id: customerId,
          to_email: (ev.payload.customer_email as string) ?? null,
          subject: interpolate((p.subject as string) ?? "", ctx),
          body: rendered,
          status: "queued",
          template_key: templateKey ?? null,
          related_type: ev.related_type,
          related_id: ev.related_id,
        });
      }
      return;
    }
    case "set_status": {
      const table = p.table as string;
      const id = (p.id as string) ?? ev.related_id;
      if (!table || !id) return;
      await supabase.from(table).update({ status: p.status }).eq("id", id);
      return;
    }
    case "assign_owner": {
      const table = p.table as string;
      const id = (p.id as string) ?? ev.related_id;
      if (!table || !id) return;
      await supabase.from(table).update({ assigned_to: p.user_id }).eq("id", id);
      return;
    }
    case "create_ticket": {
      await supabase.from("tickets").insert({
        org_id: ev.org_id,
        customer_id: (ev.payload.customer_id as string) ?? null,
        job_id: (ev.payload.job_id as string) ?? null,
        ticket_name: interpolate((p.ticket_name as string) ?? "Ticket", ctx),
        type: (p.type as string) ?? null,
        priority: (p.priority as number) ?? 3,
      });
      return;
    }
    case "webhook": {
      const url = p.url as string;
      if (!url) return;
      try {
        await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ event: ev }),
        });
      } catch {
        /* swallow — automation_runs records the failure */
      }
      return;
    }
  }
}

/** Match conditions JSON against the event payload. Empty conditions = always. */
function conditionsMatch(
  conditions: Record<string, unknown> | null,
  ev: EventRow
): boolean {
  if (!conditions || Object.keys(conditions).length === 0) return true;
  for (const [k, v] of Object.entries(conditions)) {
    if ((ev.payload as Record<string, unknown>)[k] !== v) return false;
  }
  return true;
}

/** Drain unprocessed events: match enabled automations, run actions, mark processed. */
export async function runAutomations(
  supabase: SupabaseClient,
  opts: { limit?: number } = {}
): Promise<RunResult> {
  const limit = opts.limit ?? 100;
  const result: RunResult = { processed: 0, ran: 0, failed: 0 };

  const { data: events, error: eErr } = await supabase
    .from("events")
    .select("id,org_id,type,payload,related_type,related_id,created_at")
    .is("processed_at", null)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (eErr) throw new Error(`fetch events: ${eErr.message}`);
  if (!events || events.length === 0) return result;

  const types = Array.from(new Set((events as EventRow[]).map((e) => e.type)));
  const { data: automations } = await supabase
    .from("automations")
    .select("id,org_id,name,trigger,conditions_json,actions_json,enabled")
    .eq("enabled", true)
    .in("trigger", types);

  const byTrigger = new Map<string, AutomationRow[]>();
  for (const a of (automations ?? []) as AutomationRow[]) {
    const arr = byTrigger.get(a.trigger) ?? [];
    arr.push(a);
    byTrigger.set(a.trigger, arr);
  }

  for (const ev of events as EventRow[]) {
    const matches = (byTrigger.get(ev.type) ?? []).filter(
      (a) => a.org_id === ev.org_id && conditionsMatch(a.conditions_json, ev)
    );

    for (const auto of matches) {
      // Idempotency: skip if a run already exists for this (automation, event)
      const { data: existing } = await supabase
        .from("automation_runs")
        .select("id")
        .eq("automation_id", auto.id)
        .eq("event_id", ev.id)
        .maybeSingle();
      if (existing) continue;

      const { data: runRow } = await supabase
        .from("automation_runs")
        .insert({
          automation_id: auto.id,
          event_id: ev.id,
          status: "running",
        })
        .select("id")
        .single();

      try {
        for (const action of auto.actions_json ?? []) {
          await runAction(supabase, ev, action);
        }
        await supabase
          .from("automation_runs")
          .update({ status: "ok", finished_at: new Date().toISOString() })
          .eq("id", runRow!.id);
        result.ran++;
      } catch (err) {
        await supabase
          .from("automation_runs")
          .update({
            status: "error",
            finished_at: new Date().toISOString(),
            error: (err as Error).message,
          })
          .eq("id", runRow!.id);
        result.failed++;
      }
    }

    await supabase
      .from("events")
      .update({ processed_at: new Date().toISOString() })
      .eq("id", ev.id);
    result.processed++;
  }

  return result;
}
