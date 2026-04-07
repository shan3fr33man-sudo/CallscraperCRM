/**
 * First-party plugin: callscraper.com
 *
 * Callscraper is itself a Supabase project, so the optimal ingestion mode is
 * "direct" — we use supabase-js with the service-role key to read the upstream
 * `calls`, `call_summaries`, and `leads` tables and mirror them into
 * CallscraperCRM as records.
 *
 * Other modes (REST/webhook/FDW/scraper) remain available as fallbacks so the
 * plugin can run anywhere.
 */
import { createClient } from "@supabase/supabase-js";
import { definePlugin, type IngestionContext } from "@callscrapercrm/plugin-sdk";

const UPSTREAM_URL = process.env.CALLSCRAPER_SUPABASE_URL!;
const UPSTREAM_KEY = process.env.CALLSCRAPER_SUPABASE_SERVICE_KEY!;

function upstream() {
  return createClient(UPSTREAM_URL, UPSTREAM_KEY, {
    auth: { persistSession: false },
  });
}

interface CallRow {
  id: string;
  ringcentral_id: string | null;
  date: string;
  from_number: string | null;
  to_number: string | null;
  duration: number | null;
  duration_seconds: number | null;
  direction: string | null;
  agent_ext: string | null;
  call_outcome: string | null;
  brand: string | null;
  caller_name: string | null;
  resolved_name: string | null;
  status: string | null;
  started_at: string | null;
  ended_at: string | null;
}

interface CallSummaryRow {
  call_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  call_summary: string | null;
  summary: string | null;
  call_outcome: string | null;
  move_type: string | null;
  move_date: string | null;
  price_quoted: string | null;
  lead_quality: string | null;
  sentiment: string | null;
  intent: string | null;
  transcript: string | null;
  action_items: unknown;
}

interface LeadRow {
  id: string;
  call_id: string | null;
  brand: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  created_at: string;
}

export default definePlugin({
  manifest: {
    key: "callscraper",
    name: "Callscraper.com",
    description:
      "Mirror calls, call summaries, and leads from a callscraper.com Supabase backend.",
    version: "0.1.0",
    preferredModes: ["direct", "webhook", "rest", "fdw", "scraper"],
  },

  adapters: {
    direct: {
      schedule: "*/10 * * * *",
      async pull(ctx) {
        const sb = upstream();
        const since: string =
          (ctx.config.since as string | undefined) ??
          new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

        ctx.log(`[callscraper] pulling calls since ${since}`);

        // 1) Calls
        const { data: calls, error: callsErr } = await sb
          .from("calls")
          .select("*")
          .gte("date", since)
          .order("date", { ascending: true })
          .limit(1000);
        if (callsErr) throw callsErr;

        // 2) Summaries for those calls (single batched query)
        const callIds = (calls ?? []).map((c: CallRow) => c.id);
        let summariesById = new Map<string, CallSummaryRow>();
        if (callIds.length) {
          const { data: sums, error: sumErr } = await sb
            .from("call_summaries")
            .select("*")
            .in("call_id", callIds);
          if (sumErr) throw sumErr;
          summariesById = new Map(
            (sums ?? []).map((s: CallSummaryRow) => [s.call_id as string, s]),
          );
        }

        // 3) Leads in same window
        const { data: leads, error: leadsErr } = await sb
          .from("leads")
          .select("*")
          .gte("created_at", since)
          .limit(1000);
        if (leadsErr) throw leadsErr;

        // Mirror calls (with summary merged into payload)
        let n = 0;
        for (const c of (calls ?? []) as CallRow[]) {
          const s = summariesById.get(c.id);
          await ctx.upsertRecord("call", {
            external_id: c.id,
            ringcentral_id: c.ringcentral_id,
            from: c.from_number,
            to: c.to_number,
            duration_seconds: c.duration_seconds ?? c.duration,
            direction: c.direction,
            brand: c.brand,
            caller_name: c.resolved_name ?? c.caller_name,
            agent_ext: c.agent_ext,
            outcome: c.call_outcome,
            status: c.status,
            occurred_at: c.started_at ?? c.date,
            ended_at: c.ended_at,
            summary: s?.summary ?? s?.call_summary,
            sentiment: s?.sentiment,
            intent: s?.intent,
            move_type: s?.move_type,
            move_date: s?.move_date,
            price_quoted: s?.price_quoted,
            lead_quality: s?.lead_quality,
            transcript: s?.transcript,
            action_items: s?.action_items,
          });
          n++;
        }

        // Mirror leads
        for (const l of (leads ?? []) as LeadRow[]) {
          await ctx.upsertRecord("lead", {
            external_id: l.id,
            call_external_id: l.call_id,
            brand: l.brand,
            customer_name: l.customer_name,
            customer_phone: l.customer_phone,
            customer_email: l.customer_email,
            created_at: l.created_at,
          });
          n++;
        }

        ctx.log(
          `[callscraper] direct pull complete: ${calls?.length ?? 0} calls, ${leads?.length ?? 0} leads`,
        );
        return { ingested: n };
      },
    },

    rest: {
      schedule: "*/15 * * * *",
      async pull(ctx) {
        // REST fallback — only used if a non-Supabase callscraper deployment exists.
        const base = process.env.CALLSCRAPER_BASE_URL ?? "https://callscraper.com";
        const r = await fetch(`${base}/api/calls`, {
          headers: { authorization: `Bearer ${ctx.secrets.apiKey}` },
        });
        if (!r.ok) throw new Error(`callscraper REST ${r.status}`);
        const json = (await r.json()) as { calls?: unknown[] };
        let n = 0;
        for (const c of json.calls ?? []) {
          await ctx.upsertRecord("call", c as Record<string, unknown>);
          n++;
        }
        return { ingested: n };
      },
    },

    webhook: {
      verify(req, secret) {
        const sig = req.headers["x-callscraper-signature"];
        if (!sig) throw new Error("missing signature");
        // HMAC verification handled by the route — kept as a stub here.
        if (!secret) throw new Error("no secret configured");
      },
      async handle(ctx, payload) {
        const calls = (payload as { calls?: unknown[] }).calls ?? [payload];
        let n = 0;
        for (const c of calls) {
          await ctx.upsertRecord("call", c as Record<string, unknown>);
          n++;
        }
        return { ingested: n };
      },
    },

    fdw: {
      serverName: "callscraper_fdw",
      remoteSchema: "public",
      setupSql: `-- See docs: postgres_fdw against the callscraper Supabase host`,
    },

    scraper: {
      schedule: "0 */6 * * *",
      async run(ctx) {
        ctx.log("scraper mode requested; not needed when direct mode is configured");
        return { ingested: 0 };
      },
    },
  },

  tools: [
    {
      name: "callscraper_search_calls",
      description: "Search recent calls mirrored from callscraper.com by phone or text.",
      inputSchema: {
        type: "object",
        properties: { query: { type: "string" }, limit: { type: "number" } },
      },
      async run(_ctx, _input) {
        // Implemented at the CRM layer using `records` + pgvector.
        return { results: [] };
      },
    },
  ],
});
