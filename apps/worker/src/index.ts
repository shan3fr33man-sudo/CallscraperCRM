/**
 * CallscraperCRM worker — runs scheduled ingestion for installed plugins.
 *
 * v0: single-process loop. Production: swap for BullMQ or Supabase cron.
 */
import { createClient } from "@supabase/supabase-js";
import callscraper from "@callscrapercrm/plugin-callscraper";
import { pickMode, type Plugin, type IngestionContext } from "@callscrapercrm/plugin-sdk";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const PLUGINS: Plugin[] = [callscraper];

function ctxFor(orgId: string): IngestionContext {
  return {
    orgId,
    config: {},
    secrets: {
      apiKey: process.env.CALLSCRAPER_API_KEY ?? "",
      webhookSecret: process.env.CALLSCRAPER_WEBHOOK_SECRET ?? "",
    },
    log: (msg, meta) => console.log(`[ingest] ${msg}`, meta ?? ""),
    async upsertRecord(objectKey, data) {
      const { data: row, error } = await sb
        .from("records")
        .insert({ org_id: orgId, object_id: objectKey, data })
        .select("id")
        .single();
      if (error) throw error;
      return { id: row!.id };
    },
  };
}

async function tick(orgId: string) {
  for (const plugin of PLUGINS) {
    const mode = pickMode(plugin);
    if (!mode) continue;
    const ctx = ctxFor(orgId);
    try {
      if (mode === "rest" && plugin.adapters.rest) {
        const r = await plugin.adapters.rest.pull(ctx);
        ctx.log(`${plugin.manifest.key}: rest pulled ${r.ingested}`);
      } else if (mode === "scraper" && plugin.adapters.scraper) {
        const r = await plugin.adapters.scraper.run(ctx);
        ctx.log(`${plugin.manifest.key}: scraper got ${r.ingested}`);
      }
      // webhook is push-driven; fdw is one-time setup.
    } catch (e) {
      ctx.log(`${plugin.manifest.key}: ${(e as Error).message}`);
    }
  }
}

const ORG = process.env.SEED_ORG_ID ?? "00000000-0000-0000-0000-000000000000";
console.log("CallscraperCRM worker starting…");
setInterval(() => tick(ORG).catch(console.error), 15 * 60 * 1000);
tick(ORG).catch(console.error);
