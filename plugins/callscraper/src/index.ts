/**
 * First-party plugin: callscraper.com
 *
 * Implements all four ingestion modes so the runtime can pick whichever is
 * available based on what callscraper.com exposes (cost/reliability order:
 * webhook > rest > fdw > scraper).
 */
import { definePlugin, type IngestionContext } from "@callscrapercrm/plugin-sdk";
import { createHmac, timingSafeEqual } from "node:crypto";

const BASE = process.env.CALLSCRAPER_BASE_URL ?? "https://callscraper.com";

async function ingestCalls(ctx: IngestionContext, calls: unknown[]) {
  let n = 0;
  for (const c of calls as Record<string, unknown>[]) {
    await ctx.upsertRecord("call", {
      external_id: c.id ?? c.call_id,
      from: c.from ?? c.caller_number,
      to: c.to ?? c.called_number,
      duration_seconds: c.duration ?? c.duration_seconds,
      recording_url: c.recording_url,
      transcript: c.transcript,
      occurred_at: c.created_at ?? c.occurred_at,
    });
    n++;
  }
  return { ingested: n };
}

export default definePlugin({
  manifest: {
    key: "callscraper",
    name: "Callscraper.com",
    description: "Sync calls and leads from callscraper.com via webhook, REST, FDW, or scraper.",
    version: "0.0.1",
    preferredModes: ["webhook", "rest", "fdw", "scraper"],
  },
  adapters: {
    rest: {
      schedule: "*/15 * * * *",
      async pull(ctx) {
        const r = await fetch(`${BASE}/api/calls?since=${encodeURIComponent(new Date(Date.now() - 86400000).toISOString())}`, {
          headers: { authorization: `Bearer ${ctx.secrets.apiKey}` },
        });
        if (!r.ok) throw new Error(`callscraper REST ${r.status}`);
        const json = (await r.json()) as { calls?: unknown[] };
        return ingestCalls(ctx, json.calls ?? []);
      },
    },
    webhook: {
      verify(req, secret) {
        const sig = req.headers["x-callscraper-signature"];
        if (!sig) throw new Error("missing signature");
        const expected = createHmac("sha256", secret).update(req.rawBody).digest("hex");
        const a = Buffer.from(sig);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error("bad signature");
      },
      async handle(ctx, payload) {
        const calls = (payload as { calls?: unknown[] }).calls ?? [payload];
        return ingestCalls(ctx, calls);
      },
    },
    fdw: {
      serverName: "callscraper_fdw",
      remoteSchema: "public",
      setupSql: `
        -- Requires postgres_fdw extension and credentials configured by the operator.
        -- create extension if not exists postgres_fdw;
        -- create server callscraper_fdw foreign data wrapper postgres_fdw options (host '...', dbname '...');
        -- import foreign schema public limit to (calls) from server callscraper_fdw into ext_callscraper;
      `,
    },
    scraper: {
      schedule: "0 */6 * * *",
      async run(ctx) {
        // Fallback: Playwright login + scrape dashboard. Implemented in apps/worker.
        ctx.log("scraper mode requested; delegated to worker", { plugin: "callscraper" });
        return { ingested: 0 };
      },
    },
  },
  tools: [
    {
      name: "callscraper_search_calls",
      description: "Search recent calls ingested from callscraper.com",
      inputSchema: { type: "object", properties: { query: { type: "string" } } },
      async run(_ctx, _input) {
        return { results: [] };
      },
    },
  ],
});
