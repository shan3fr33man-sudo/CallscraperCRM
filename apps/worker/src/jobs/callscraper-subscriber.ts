/**
 * CallScraper v3 → CRM estimator subscriber.
 *
 * CallScraper v3 does not fire an outbound webhook. Its Gemini-processed
 * summary lands ~30s–3m after a call ends in the CallScraper Supabase's
 * `call_summaries` table. This job:
 *   1. Resumes a persisted cursor from the CRM's `sync_state` table (last
 *      processed `call_summaries.created_at`), capped at a 48h look-back.
 *   2. Backfills any missed rows in the background (non-blocking).
 *   3. Subscribes to realtime INSERTs on `call_summaries`.
 *   4. For each row: joins with `calls`, normalizes, HMAC-signs, POSTs the
 *      CRM webhook.
 *   5. On channel disconnect, retries with exponential backoff (1s → 60s).
 *   6. On SIGINT/SIGTERM, unsubscribes cleanly so PM2 graceful restart works.
 *
 * Idempotency is enforced downstream by the webhook's sessionId dedupe.
 *
 * Run:
 *   pnpm --filter @callscrapercrm/worker exec tsx src/jobs/callscraper-subscriber.ts
 *
 * Env:
 *   CALLSCRAPER_SUPABASE_URL    (v3 project — earddtfueyboluglwbgt)
 *   CALLSCRAPER_SUPABASE_KEY    (anon or service role for v3)
 *   CRM_SUPABASE_URL            (CRM project — for sync_state cursor)
 *   CRM_SUPABASE_KEY            (service role on CRM project)
 *   CRM_WEBHOOK_URL             (https://<crm-domain>/api/webhooks/callscraper)
 *   CALLSCRAPER_WEBHOOK_SECRET  (shared HMAC secret)
 */
import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import { createHmac } from "node:crypto";

export interface SubscriberOpts {
  callscraperSupabaseUrl: string;
  callscraperSupabaseKey: string;
  crmSupabaseUrl: string;
  crmSupabaseKey: string;
  crmWebhookUrl: string;
  webhookSecret: string;
  log?: (msg: string, meta?: unknown) => void;
  /** Max look-back on startup if no cursor exists yet. */
  maxCatchUpHours?: number;
}

/**
 * Cursor is stored in the existing `sync_state` table (migration 0002). Its
 * schema is (org_id, provider_key, table_name, cursor, rows_synced, last_run_at).
 * We reuse it instead of introducing a new kv table. Defaults to the default
 * organization — this subscriber is a singleton process, not per-tenant.
 */
const CURSOR_ORG_ID = "00000000-0000-0000-0000-000000000001";
const CURSOR_PROVIDER = "callscraper_subscriber";
const CURSOR_TABLE = "call_summaries";

interface CallSummaryRow {
  id: string;
  call_id: string;
  intent: string | null;
  summary: string | null;
  crew_estimate: string | null;
  truck_estimate: string | null;
  tags: string[] | null;
  call_outcome: string | null;
  created_at: string;
}

interface CallRow {
  call_id: string;
  from_number: string | null;
  caller_name: string | null;
  resolved_name: string | null;
  brand: string | null;
  started_at: string | null;
  ended_at: string | null;
  direction: string | null;
  extension_id: string | null;
  agent_name: string | null;
  sm_customer_id: string | null;
  sm_opp_id: string | null;
  origin_address: string | null;
  origin_lat: number | null;
  origin_lng: number | null;
  origin_streetview_url: string | null;
  destination_address: string | null;
  dest_lat: number | null;
  dest_lng: number | null;
  dest_streetview_url: string | null;
  move_size: string | null;
  move_date: string | null;
  transcript: string | null;
}

export async function runCallScraperSubscriber(opts: SubscriberOpts): Promise<void> {
  const log = opts.log ?? ((m: string, meta?: unknown) => console.log(`[cs-sub] ${m}`, meta ?? ""));
  const maxCatchUpHours = opts.maxCatchUpHours ?? 48;

  const csSb = createClient(opts.callscraperSupabaseUrl, opts.callscraperSupabaseKey, {
    auth: { persistSession: false },
    realtime: { params: { eventsPerSecond: 10 } },
  });
  const crmSb = createClient(opts.crmSupabaseUrl, opts.crmSupabaseKey, {
    auth: { persistSession: false },
  });

  const state = { shuttingDown: false, channel: null as RealtimeChannel | null };

  // Catch-up backlog runs in background so the realtime channel subscribes
  // without waiting. Idempotency is enforced by the webhook.
  void runCatchUp({ csSb, crmSb, opts, log, maxCatchUpHours }).catch((err) => {
    log(`catch-up failed: ${(err as Error).message}`);
  });

  const connect = async (attempt: number = 0): Promise<void> => {
    if (state.shuttingDown) return;
    const backoffMs = Math.min(60_000, 1000 * 2 ** attempt);
    log(`subscribing (attempt ${attempt + 1})`);

    const channel = csSb
      .channel("callscraper-call-summaries")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "call_summaries" },
        async (ev) => {
          const row = ev.new as CallSummaryRow;
          try {
            await processSummary(csSb, crmSb, row, opts, log);
          } catch (e) {
            log(`realtime processing failed for ${row.call_id}: ${(e as Error).message}`);
          }
        },
      )
      .subscribe(async (status) => {
        log(`realtime channel status: ${status}`);
        if (state.shuttingDown) return;
        if (status === "SUBSCRIBED") {
          return; // Happy path.
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          try {
            await channel.unsubscribe();
          } catch {
            /* ignore */
          }
          state.channel = null;
          log(`backing off ${backoffMs}ms before reconnect`);
          setTimeout(() => void connect(attempt + 1), backoffMs);
        }
      });

    state.channel = channel;
  };

  await connect();

  const shutdown = async (sig: string) => {
    log(`${sig} — tearing down channel`);
    state.shuttingDown = true;
    if (state.channel) {
      try {
        await state.channel.unsubscribe();
      } catch {
        /* ignore */
      }
    }
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  // Keep the process alive.
  await new Promise<void>(() => {});
}

/** Read the persisted `sync_state.cursor`; fall back to (now - maxCatchUpHours). */
async function getCursor(
  crmSb: SupabaseClient,
  maxCatchUpHours: number,
): Promise<string> {
  const { data } = await crmSb
    .from("sync_state")
    .select("cursor")
    .eq("org_id", CURSOR_ORG_ID)
    .eq("provider_key", CURSOR_PROVIDER)
    .eq("table_name", CURSOR_TABLE)
    .maybeSingle();
  const cursorIso = (data as { cursor?: string } | null)?.cursor;
  if (cursorIso) {
    const ts = new Date(cursorIso);
    const minCutoff = new Date(Date.now() - maxCatchUpHours * 60 * 60 * 1000);
    return ts > minCutoff ? cursorIso : minCutoff.toISOString();
  }
  return new Date(Date.now() - maxCatchUpHours * 60 * 60 * 1000).toISOString();
}

async function setCursor(crmSb: SupabaseClient, iso: string): Promise<void> {
  await crmSb.from("sync_state").upsert(
    {
      org_id: CURSOR_ORG_ID,
      provider_key: CURSOR_PROVIDER,
      table_name: CURSOR_TABLE,
      cursor: iso,
      last_run_at: new Date().toISOString(),
    },
    { onConflict: "org_id,provider_key,table_name" },
  );
}

async function runCatchUp(args: {
  csSb: SupabaseClient;
  crmSb: SupabaseClient;
  opts: SubscriberOpts;
  log: (m: string, meta?: unknown) => void;
  maxCatchUpHours: number;
}): Promise<void> {
  const { csSb, crmSb, opts, log, maxCatchUpHours } = args;
  const since = await getCursor(crmSb, maxCatchUpHours);
  const { data: backlog, error } = await csSb
    .from("call_summaries")
    .select("*")
    .gte("created_at", since)
    .order("created_at", { ascending: true });
  if (error) {
    log(`catch-up fetch error: ${error.message}`);
    return;
  }
  if (!backlog || backlog.length === 0) {
    log(`catch-up: no backlog since ${since}`);
    return;
  }
  log(`catch-up: ${backlog.length} rows since ${since}`);
  let processedCount = 0;
  for (const row of backlog as CallSummaryRow[]) {
    try {
      await processSummary(csSb, crmSb, row, opts, log);
      processedCount++;
      if (processedCount % 50 === 0) {
        await setCursor(crmSb, row.created_at);
      }
    } catch (e) {
      log(`catch-up processing failed for ${row.call_id}: ${(e as Error).message}`);
    }
  }
  const lastRow = backlog[backlog.length - 1] as CallSummaryRow;
  if (lastRow) await setCursor(crmSb, lastRow.created_at);
  log(`catch-up complete: ${processedCount} processed`);
}

async function processSummary(
  csSb: SupabaseClient,
  crmSb: SupabaseClient,
  summary: CallSummaryRow,
  opts: SubscriberOpts,
  log: (msg: string, meta?: unknown) => void,
): Promise<void> {
  if (!summary.call_id) return;

  const { data: call } = await csSb
    .from("calls")
    .select("*")
    .eq("call_id", summary.call_id)
    .maybeSingle<CallRow>();
  if (!call) {
    log(`no calls row for sessionId ${summary.call_id}; skipping`);
    return;
  }
  if (!call.from_number) {
    log(`calls row ${summary.call_id} has no from_number; skipping`);
    return;
  }

  const body = {
    event: "call.completed" as const,
    source: "subscriber" as const,
    sessionId: summary.call_id,
    company: call.brand ?? undefined,
    extensionId: call.extension_id ?? undefined,
    direction: (call.direction as "inbound" | "outbound" | undefined) ?? undefined,
    agentName: call.agent_name ?? undefined,
    startedAt: call.started_at ?? undefined,
    endedAt: call.ended_at ?? undefined,
    caller: {
      phone: call.from_number,
      name: call.resolved_name ?? call.caller_name ?? undefined,
      rcName: call.caller_name ?? undefined,
    },
    sm: {
      customerId: call.sm_customer_id ?? undefined,
      opportunityId: call.sm_opp_id ?? undefined,
    },
    addresses: {
      originAddress: call.origin_address ?? undefined,
      originLat: call.origin_lat ?? undefined,
      originLng: call.origin_lng ?? undefined,
      originStreetViewUrl: call.origin_streetview_url ?? undefined,
      destinationAddress: call.destination_address ?? undefined,
      destinationLat: call.dest_lat ?? undefined,
      destinationLng: call.dest_lng ?? undefined,
      destinationStreetViewUrl: call.dest_streetview_url ?? undefined,
    },
    summary: {
      intent: summary.intent ?? undefined,
      text: summary.summary ?? undefined,
      crewEstimate: summary.crew_estimate ?? undefined,
      truckEstimate: summary.truck_estimate ?? undefined,
      tags: summary.tags ?? undefined,
      callOutcome: summary.call_outcome ?? undefined,
      moveSize: call.move_size ?? undefined,
      moveDate: call.move_date ?? undefined,
      transcript: call.transcript ?? undefined,
    },
  };

  const raw = JSON.stringify(body);
  const sig = createHmac("sha256", opts.webhookSecret).update(raw).digest("hex");

  const res = await fetch(opts.crmWebhookUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-callscraper-signature": sig,
    },
    body: raw,
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "<no body>");
    log(`CRM webhook rejected ${summary.call_id}: ${res.status} ${msg}`);
    return;
  }
  const result = (await res.json().catch(() => ({}))) as {
    opportunity_id?: string;
    estimate_id?: string | null;
    idempotent?: boolean;
  };
  log(
    `processed ${summary.call_id}${result.idempotent ? " (idempotent)" : ""} → opp=${result.opportunity_id} est=${result.estimate_id ?? "none"}`,
  );
  // Update cursor after each successful realtime delivery too.
  try {
    await setCursor(crmSb, summary.created_at);
  } catch {
    /* best-effort; cursor will sync on next backfill */
  }
}

// CLI entry
if (import.meta.url === `file://${process.argv[1]}`) {
  const csUrl = process.env.CALLSCRAPER_SUPABASE_URL;
  const csKey = process.env.CALLSCRAPER_SUPABASE_KEY;
  const crmUrl = process.env.CRM_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const crmKey = process.env.CRM_SUPABASE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const webhook = process.env.CRM_WEBHOOK_URL;
  const secret = process.env.CALLSCRAPER_WEBHOOK_SECRET;
  if (!csUrl || !csKey || !crmUrl || !crmKey || !webhook || !secret) {
    console.error(
      "Required env: CALLSCRAPER_SUPABASE_URL, CALLSCRAPER_SUPABASE_KEY, CRM_SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL), CRM_SUPABASE_KEY (or SUPABASE_SERVICE_ROLE_KEY), CRM_WEBHOOK_URL, CALLSCRAPER_WEBHOOK_SECRET",
    );
    process.exit(1);
  }
  runCallScraperSubscriber({
    callscraperSupabaseUrl: csUrl,
    callscraperSupabaseKey: csKey,
    crmSupabaseUrl: crmUrl,
    crmSupabaseKey: crmKey,
    crmWebhookUrl: webhook,
    webhookSecret: secret,
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
