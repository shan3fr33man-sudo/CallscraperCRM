import "server-only";
import { crmClient, DEFAULT_ORG_ID } from "./crmdb";
import { callscraperClient } from "./callscraper";
import { emitEvent } from "./river";
import { getCursor, advanceCursor, markError } from "./sync-state";
import { upsertCustomersBatch } from "./upsert-customer";
import { normalizePhone } from "./phone";

const BATCH = 500;
const EPOCH = "2020-01-01T00:00:00Z";

export type SyncResult = { entity: string; rows: number; errors: string[]; duration_ms: number };

// ---------- calls -> customers + activities (kind='call') ----------
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

      // --- Batch customer upsert ---
      const custEntries = rows.map((r) => ({
        phone: r.direction === "inbound" ? r.from_number : r.to_number,
        opts: {
          customer_name: r.resolved_name ?? r.caller_name,
          brand: r.brand,
          source: "phone" as const,
        },
      }));
      const phoneToCustomerId = await upsertCustomersBatch(custEntries);

      // --- Batch activity dedup ---
      const externalIds = rows.map((r) => String(r.id));
      // Query existing activities by external_id using the index
      // PostgREST doesn't support .in() on JSONB paths, so use .or() with individual eq conditions
      const orFilter = externalIds.map((eid) => `payload->>external_id.eq.${eid}`).join(",");
      const { data: existingActs } = await sb
        .from("activities")
        .select("id, payload")
        .eq("org_id", DEFAULT_ORG_ID)
        .eq("kind", "call")
        .or(orFilter);

      const existingMap = new Map<string, string>();
      for (const act of existingActs ?? []) {
        const extId = (act.payload as Record<string, unknown>)?.external_id;
        if (extId) existingMap.set(String(extId), act.id as string);
      }

      // --- Build insert/update lists ---
      const toInsert: Record<string, unknown>[] = [];
      const toUpdate: { id: string; payload: Record<string, unknown> }[] = [];

      for (const r of rows) {
        const phone = normalizePhone(r.direction === "inbound" ? r.from_number : r.to_number);
        const custId = phoneToCustomerId.get(phone);
        if (!custId) continue;

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

        const existingId = existingMap.get(String(r.id));
        if (existingId) {
          toUpdate.push({ id: existingId, payload });
        } else {
          toInsert.push({
            org_id: DEFAULT_ORG_ID,
            kind: "call",
            record_id: custId,
            payload,
            created_at: r.started_at ?? r.created_at,
          });
        }
      }

      // --- Bulk insert new activities ---
      if (toInsert.length > 0) {
        const { error: insErr } = await sb.from("activities").insert(toInsert);
        if (insErr) errors.push(`activity insert: ${insErr.message}`);
      }

      // --- Update existing activities (few per batch on incremental runs) ---
      for (const u of toUpdate) {
        await sb.from("activities").update({ payload: u.payload }).eq("id", u.id);
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

      // --- Batch: find matching activities for all call_ids ---
      const callIds = rows.filter((r) => r.call_id).map((r) => String(r.call_id));
      const orFilterSummary = callIds.map((cid) => `payload->>external_id.eq.${cid}`).join(",");
      const { data: matchedActs } = callIds.length > 0
        ? await sb
            .from("activities")
            .select("id, record_id, payload")
            .eq("org_id", DEFAULT_ORG_ID)
            .eq("kind", "call")
            .or(orFilterSummary)
        : { data: [] };

      const actByCallId = new Map<string, { id: string; record_id: string | null; payload: Record<string, unknown> }>();
      for (const act of matchedActs ?? []) {
        const extId = (act.payload as Record<string, unknown>)?.external_id;
        if (extId) actByCallId.set(String(extId), {
          id: act.id as string,
          record_id: act.record_id as string | null,
          payload: (act.payload as Record<string, unknown>) ?? {},
        });
      }

      // --- Process each summary ---
      for (const r of rows) {
        if (!r.call_id) continue;
        const act = actByCallId.get(String(r.call_id));
        if (!act) continue;

        const merged = {
          ...act.payload,
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
        await sb.from("activities").update({ payload: merged }).eq("id", act.id);

        // Hot/warm lead auto-opportunity
        if ((r.lead_quality === "hot" || r.lead_quality === "warm") && act.record_id) {
          const existingOpp = await sb
            .from("opportunities")
            .select("id")
            .eq("org_id", DEFAULT_ORG_ID)
            .eq("customer_id", act.record_id)
            .eq("status", "new")
            .limit(1)
            .maybeSingle();
          if (!existingOpp.data?.id) {
            const amount = Number(String(r.price_quoted ?? "0").replace(/[^\d.]/g, "")) || 0;
            const oppIns = await sb
              .from("opportunities")
              .insert({
                org_id: DEFAULT_ORG_ID,
                customer_id: act.record_id,
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
                payload: { opportunity_id: oppIns.data.id, customer_id: act.record_id, source: "phone", lead_quality: r.lead_quality },
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

      // --- Batch customer upsert ---
      const custEntries = rows.map((r) => ({
        phone: r.customer_phone,
        opts: {
          customer_name: r.customer_name,
          customer_email: r.customer_email,
          brand: r.brand,
          source: "phone" as const,
        },
      }));
      const phoneToCustomerId = await upsertCustomersBatch(custEntries);

      // --- Batch dedup opportunities by upstream_id ---
      const upstreamIds = rows.map((r) => r.id);
      const { data: existingOpps } = await sb
        .from("opportunities")
        .select("upstream_id")
        .eq("org_id", DEFAULT_ORG_ID)
        .in("upstream_id", upstreamIds);
      const existingUpstreamIds = new Set((existingOpps ?? []).map((o) => o.upstream_id));

      // --- Build opportunity inserts ---
      const oppInserts: Record<string, unknown>[] = [];
      for (const r of rows) {
        if (existingUpstreamIds.has(r.id)) continue;
        const phone = normalizePhone(r.customer_phone);
        const custId = phoneToCustomerId.get(phone);
        if (!custId) continue;

        oppInserts.push({
          org_id: DEFAULT_ORG_ID,
          upstream_id: r.id,
          customer_id: custId,
          brand: r.brand,
          status: "new",
          source: "phone",
          created_at: r.created_at,
        });
      }

      // --- Bulk insert opportunities ---
      if (oppInserts.length > 0) {
        const { data: inserted, error: insErr } = await sb
          .from("opportunities")
          .insert(oppInserts)
          .select("id, customer_id");
        if (insErr) {
          errors.push(`opp insert: ${insErr.message}`);
        } else {
          for (const opp of inserted ?? []) {
            await emitEvent(sb, {
              org_id: DEFAULT_ORG_ID,
              type: "opportunity.created",
              related_type: "opportunity",
              related_id: opp.id as string,
              payload: { opportunity_id: opp.id, customer_id: opp.customer_id, source: "phone", from: "lead_sync" },
            });
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

export async function runFullSync(opts: { fullReconcile?: boolean } = {}): Promise<SyncResult[]> {
  const results: SyncResult[] = [];
  try { results.push(await syncCalls(opts)); } catch (e) { results.push({ entity: "calls", rows: 0, errors: [(e as Error).message], duration_ms: 0 }); }
  try { results.push(await syncCallSummaries()); } catch (e) { results.push({ entity: "call_summaries", rows: 0, errors: [(e as Error).message], duration_ms: 0 }); }
  try { results.push(await syncLeads()); } catch (e) { results.push({ entity: "leads", rows: 0, errors: [(e as Error).message], duration_ms: 0 }); }
  return results;
}
