/**
 * CallscraperCRM Plugin SDK
 *
 * A plugin can implement any combination of four ingestion modes — the runtime
 * picks the best available one (cost/reliability order: webhook > rest > fdw > scraper).
 */

export type IngestionMode = "direct" | "webhook" | "rest" | "fdw" | "scraper";

/**
 * Direct adapter — talks to the upstream system using its native client
 * (e.g. supabase-js with service key, a Postgres pool, a gRPC client).
 * Cheapest + most reliable when available.
 */
export interface DirectAdapter {
  pull: (ctx: IngestionContext) => Promise<{ ingested: number }>;
  schedule?: string;
}

export interface IngestionContext {
  orgId: string;
  config: Record<string, unknown>;
  secrets: Record<string, string>;
  upsertRecord: (objectKey: string, data: Record<string, unknown>) => Promise<{ id: string }>;
  log: (msg: string, meta?: Record<string, unknown>) => void;
}

export interface RestAdapter {
  /** Pull from the upstream API on a schedule. */
  pull: (ctx: IngestionContext) => Promise<{ ingested: number }>;
  /** Cron expression — defaults to every 15 minutes. */
  schedule?: string;
}

export interface WebhookAdapter {
  /** Verify signature on the inbound request. Throw to reject. */
  verify: (req: { headers: Record<string, string>; rawBody: string }, secret: string) => void | Promise<void>;
  /** Handle a verified webhook payload. */
  handle: (ctx: IngestionContext, payload: unknown) => Promise<{ ingested: number }>;
}

export interface FdwAdapter {
  /** Postgres FDW server name + remote schema/tables to mount. */
  serverName: string;
  remoteSchema: string;
  /** SQL run after FDW is wired (views, triggers). */
  setupSql?: string;
}

export interface ScraperAdapter {
  /** Playwright-driven scrape. Should be the fallback of last resort. */
  run: (ctx: IngestionContext) => Promise<{ ingested: number }>;
  schedule?: string;
}

export interface PluginManifest {
  key: string;
  name: string;
  description: string;
  version: string;
  author?: string;
  /** Order indicates user preference; runtime still picks the best available. */
  preferredModes?: IngestionMode[];
}

export interface PluginTool {
  name: string;
  description: string;
  inputSchema: unknown; // JSON schema
  run: (ctx: IngestionContext, input: unknown) => Promise<unknown>;
}

export interface Plugin {
  manifest: PluginManifest;
  adapters: {
    direct?: DirectAdapter;
    rest?: RestAdapter;
    webhook?: WebhookAdapter;
    fdw?: FdwAdapter;
    scraper?: ScraperAdapter;
  };
  tools?: PluginTool[];
  onInstall?: (ctx: IngestionContext) => Promise<void>;
}

export function definePlugin(plugin: Plugin): Plugin {
  return plugin;
}

/** Runtime-selectable mode order; first one with an adapter wins. */
export const MODE_PRIORITY: IngestionMode[] = ["direct", "webhook", "rest", "fdw", "scraper"];

export function pickMode(plugin: Plugin): IngestionMode | null {
  const order = plugin.manifest.preferredModes ?? MODE_PRIORITY;
  for (const m of order) if (plugin.adapters[m]) return m;
  return null;
}
