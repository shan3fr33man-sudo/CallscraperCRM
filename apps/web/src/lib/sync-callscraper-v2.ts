import "server-only";
import { crmClient, DEFAULT_ORG_ID } from "./crmdb";
import { callscraperClient } from "./callscraper";
import { emitEvent } from "./river";
import { getCursor, advanceCursor, markError } from "./sync-state";
import { upsertCustomer } from "./upsert-customer";

const BATCH = 500;
const EPOCH = "2020-01-01T00:00:00Z";

export type SyncResult = { entity: string; rows: number; errors: string[]; duration_ms: number };

// ---------- calls -> activities (kind='call') ----------
export async function syncCalls(opts: { fullReconcile?: boolean } = {}): Promise<SyncResult> {
  const start = Date.now();
  const entity = "calls";
  let cursor = opts.fullReconcile ? EPOCH : await getCursor(entity);
  let rowsSynced = 0;
  const errors: string[] = [];
  const up = callscraperClient();
  const sb = crmClient();

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data, error } = await up
        .from("calls")
        .select("id, from_number, to_number, duration_seconds, direction, call_outcome, brand, resolved_name, caller_name, started_at, ended_at, created_at")
        .gt("created_at", cursor)
        .order("created_at", { ascending: true })
        .limit(BATCH);
      if (error) throw new Error(error.message);
      const rows = data ?? [];
      if (rows.length === 0) break;

      for (const r of rows) {
        const phone = r.direction === "inbound" ? r.from_number : r.to_number;
        const cust = await upsertCustomer(phone, {
          customer_name: r.resolved_name ?? r.caller_name,
          brand: r.brand,
          source: "phone",
        });
        if (!cust) continue;

        const payload = {
          external_id: r.id,
          from_number: r.from_number,
          to_number: r.to_number,
          duration_seconds: r.duration_seconds,
          direction: r.direction,
          call_outcome: r.call_outcome,
          brand: r.brand,
          started_at: r.started_at,
          ended_at: r.ended_at,
        };

        // Dedup by payload->>'external_id'
        const existing = await sb
          .from("activities")
          .select("id")
          .eq("org_id", DEFAULT_ORG_ID)
          .eq("kind", "call")
          .filter("payload->>external_id", "eq", String(r.id))
          .limit(1)
          .maybeSingle();

        if (existing.data?.id) {
          await sb.from("activities").update({ payload }).eq("id", existing.data.id);
        } else {
          await sb.from("activities").insert({
            org_id: DEFAULT_ORG_ID,
            kind: "call",
            record_id: cust.id,
            payload,
            created_at: r.started_at ?? r.created_at,
          });
        }
      }

      cursor = rows[rows.length - 1].created_at as string;
      rowsSynced += rows.length;
      await advanceCursor(entity, cursor, rowsSynced);
      if (rows.length < BATCH) break;
    }
    await emitEvent(sb, {
      org_id: DEFAULT_ORG_ID,
      type: "sync.run.completed",
      related_type: "sync",
      related_id: undefined,
      payload: { entity, rows_upserted: rowsSynced, duration_ms: Date.now() - start },
    });
  } catch (e) {
    const msg = (e as Error).message;
    errors.push(msg);
    await markError(entity, msg);
  }

  return { entity, rows: rowsSynced, errors, duration_ms: Date.now() - start };
}

// ---------- call_summaries -> merge into activities; hot leads -> opportunities ----------
export async function syncCallSummaries(): Promise<SyncResult> {
  const start = Date.now();
  const entity = "call_summaries";
  let cursor = await getCursor(entity);
  let rowsSynced = 0;
  const errors: string[] = [];
  const up = callscraperClient();
  const sb = crmClient();

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data, error } = await up
        .from("call_summaries")
        .select("id, call_id, customer_name, customer_phone, summary, call_summary, call_outcome, move_type, move_date, price_quoted, lead_quality, sentiment, intent, transcript, key_details, action_items, created_at")
        .gt("created_at", cursor)
        .order("created_at", { ascending: true })
        .limit(BATCH);
      if (error) throw new Error(error.message);
      const rows = data ?? [];
      if (rows.length === 0) break;

      for (const r of rows) {
        if (!r.call_id) continue;
        const act = await sb
          .from("activities")
          .select("id, record_id, payload")
          .eq("org_id", DEFAULT_ORG_ID)
          .eq("kind", "call")
          .filter("payload->>external_id", "eq", String(r.call_id))
          .limit(1)
          .maybeSingle();
        if (!act.data?.id) continue;

        const merged = {
          ...((act.data.payload as Record<string, unknown>) ?? {}),
          summary: r.summary ?? r.call_summary,
          transcript: r.transcript,
          sentiment: r.sentiment,
          intent: r.intent,
          move_type: r.move_type,
          move_date: r.move_date,
          price_quoted: r.price_quoted,
          lead_quality: r.lead_quality,
          key_details: r.key_details,
          action_items: r.action_items,
        };
        await sb.from("activities").update({ payload: merged }).eq("id", act.data.id);

        // Hot/warm lead auto-opportunity
        if ((r.lead_quality === "hot" || r.lead_quality === "warm") && act.data.record_id) {
          const existingOpp = await sb
            .from("opportunities")
            .select("id")
            .eq("org_id", DEFAULT_ORG_ID)
            .eq("customer_id", act.data.record_id)
            .eq("status", "new")
            .limit(1)
            .maybeSingle();
          if (!existingOpp.data?.id) {
            const amount = Number(String(r.price_quoted ?? "0").replace(/[^\d.]/g, "")) || 0;
            const oppIns = await sb
              .from("opportunities")
              .insert({
                org_id: DEFAULT_ORG_ID,
                customer_id: act.data.record_id,
                status: "new",
                move_type: r.move_type,
                service_date: r.move_date,
                amount,
                source: "phone",
                lead_quality: r.lead_quality,
                intent: r.intent,
              })
              .select("id")
              .single();
            if (oppIns.data?.id) {
              await emitEvent(sb, {
                org_id: DEFAULT_ORG_ID,
                type: "opportunity.created",
                related_type: "opportunity",
                related_id: oppIns.data.id,
                payload: { opportunity_id: oppIns.data.id, customer_id: act.data.record_id, source: "phone", lead_quality: r.lead_quality },
              });
            }
          }
        }
      }

      cursor = rows[rows.length - 1].created_at as string;
      rowsSynced += rows.length;
      await advanceCursor(entity, cursor, rowsSynced);
      if (rows.length < BATCH) break;
    }
    await emitEvent(sb, {
      org_id: DEFAULT_ORG_ID,
      type: "sync.run.completed",
      related_type: "sync",
      related_id: undefined,
      payload: { entity, rows_upserted: rowsSynced, duration_ms: Date.now() - start },
    });
  } catch (e) {
    const msg = (e as Error).message;
    errors.push(msg);
    await markError(entity, msg);
  }
  return { entity, rows: rowsSynced, errors, duration_ms: Date.now() - start };
}

// ---------- leads -> customers + opportunities ----------
export async function syncLeads(): Promise<SyncResult> {
  const start = Date.now();
  const entity = "leads";
  let cursor = await getCursor(entity);
  let rowsSynced = 0;
  const errors: string[] = [];
  const up = callscraperClient();
  const sb = crmClient();

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data, error } = await up
        .from("leads")
        .select("id, call_id, brand, customer_name, customer_phone, customer_email, created_at")
        .gt("created_at", cursor)
        .order("created_at", { ascending: true })
        .limit(BATCH);
      if (error) throw new Error(error.message);
      const rows = data ?? [];
      if (rows.length === 0) break;

      for (const r of rows) {
        const cust = await upsertCustomer(r.customer_phone, {
          customer_name: r.customer_name,
          customer_email: r.customer_email,
          brand: r.brand,
          source: "phone",
        });
        if (!cust) continue;

        const existing = await sb
          .from("opportunities")
          .select("id")
          .eq("org_id", DEFAULT_ORG_ID)
          .eq("upstream_id", r.id)
          .limit(1)
          .maybeSingle();
        if (existing.data?.id) continue;

        const oppIns = await sb
          .from("opportunities")
          .insert({
            org_id: DEFAULT_ORG_ID,
            upstream_id: r.id,
            customer_id: cust.id,
            brand: r.brand,
            status: "new",
            source: "phone",
            created_at: r.created_at,
          })
          .select("id")
          .single();
        if (oppIns.data?.id) {
          await emitEvent(sb, {
            org_id: DEFAULT_ORG_ID,
            type: "opportunity.created",
            related_type: "opportunity",
            related_id: oppIns.data.id,
            payload: { opportunity_id: oppIns.data.id, customer_id: cust.id, source: "phone", from: "lead_sync" },
          });
        }
      }

      cursor = rows[rows.length - 1].created_at as string;
      rowsSynced += rows.length;
      await advanceCursor(entity, cursor, rowsSynced);
      if (rows.length < BATCH) break;
    }
    await emitEvent(sb, {
      org_id: DEFAULT_ORG_ID,
      type: "sync.run.completed",
      related_type: "sync",
      related_id: undefined,
      payload: { entity, rows_upserted: rowsSynced, duration_ms: Date.now() - start },
    });
  } catch (e) {
    const msg = (e as Error).message;
    errors.push(msg);
    await markError(entity, msg);
  }
  return { entity, rows: rowsSynced, errors, duration_ms: Date.now() - start };
}

export async function runFullSync(opts: { fullReconcile?: boolean } = {}): Promise<SyncResult[]> {
  const results: SyncResult[] = [];
  try { results.push(await syncCalls(opts)); } catch (e) { results.push({ entity: "calls", rows: 0, errors: [(e as Error).message], duration_ms: 0 }); }
  try { results.push(await syncCallSummaries()); } catch (e) { results.push({ entity: "call_summaries", rows: 0, errors: [(e as Error).message], duration_ms: 0 }); }
  try { results.push(await syncLeads()); } catch (e) { results.push({ entity: "leads", rows: 0, errors: [(e as Error).message], duration_ms: 0 }); }
  return results;
}
