/**
 * REST API client for callscraper.com (Option 2 — add alongside direct Supabase sync).
 *
 * The REST API is documented but NOT YET BUILT on callscraper.com.
 * This adapter is ready to connect when Ken ships the endpoints.
 *
 * Endpoints:
 *   GET /api/v1/reports       — paginated call reports
 *   GET /api/v1/reports/:id   — single report with full transcript
 *   GET /api/v1/stats         — aggregated metrics
 *
 * Auth: x-api-key header
 * Base URL: https://callscraper.com (or CALLSCRAPER_BASE_URL env override)
 *
 * All field names match the locked vocabulary — see plan "Naming rules locked in".
 */
import "server-only";
import type { Brand } from "./callscraper";

// ---------- Response types ----------

/** A call report from /api/v1/reports (calls + call_summaries denormalized) */
export interface CSReport {
  id: string;
  from_number: string | null;
  to_number: string | null;
  duration_seconds: number | null;
  direction: string | null;
  call_outcome: string | null;
  brand: Brand | null;
  customer_name: string | null;
  customer_phone: string | null;
  summary: string | null;
  sentiment: string | null;
  intent: string | null;
  lead_quality: string | null;
  move_type: string | null;
  move_date: string | null;
  price_quoted: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
}

/** Full report detail from /api/v1/reports/:id */
export interface CSReportDetail extends CSReport {
  transcript: string | null;
  key_details: Record<string, unknown> | null;
  action_items: string[] | null;
  inventory_notes: string | null;
  summary_was_scrubbed: boolean;
  scrubbed_at: string | null;
}

/** Aggregated stats from /api/v1/stats */
export interface CSStats {
  total_calls: number;
  total_duration_seconds: number;
  calls_by_brand: Record<string, number>;
  calls_by_outcome: Record<string, number>;
  average_duration_seconds: number;
  unique_customers: number;
  period: { from: string; to: string };
}

/** Paginated wrapper */
export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

// ---------- Client ----------

export class CallscraperApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "CallscraperApiError";
  }
}

export interface CallscraperRestClientOpts {
  baseUrl?: string;
  apiKey?: string;
}

/**
 * Create a typed REST client for callscraper.com.
 * @param apiKey — from integration_credentials or env. Throws if not set.
 */
export function callscraperRestClient(opts: CallscraperRestClientOpts = {}) {
  const baseUrl = opts.baseUrl ?? process.env.CALLSCRAPER_BASE_URL ?? "https://callscraper.com";
  const apiKey = opts.apiKey ?? process.env.CALLSCRAPER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "CallScraper REST API key not configured. " +
      "Set CALLSCRAPER_API_KEY env var or store via Settings → Integrations → API Keys."
    );
  }

  async function request<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(path, baseUrl);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, v);
      }
    }
    const res = await fetch(url.toString(), {
      headers: {
        "x-api-key": apiKey!,
        "accept": "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new CallscraperApiError(res.status, `CallScraper API ${res.status}: ${body}`);
    }
    return res.json() as Promise<T>;
  }

  return {
    /**
     * List call reports with pagination.
     * @param since — ISO 8601 timestamp, only return reports after this time
     */
    getReports: (opts?: { page?: number; per_page?: number; since?: string }) => {
      const params: Record<string, string> = {};
      if (opts?.page) params.page = String(opts.page);
      if (opts?.per_page) params.per_page = String(opts.per_page);
      if (opts?.since) params.since = opts.since;
      return request<PaginatedResponse<CSReport>>("/api/v1/reports", params);
    },

    /** Get a single report with full transcript + all AI fields. */
    getReport: (id: string) =>
      request<CSReportDetail>(`/api/v1/reports/${encodeURIComponent(id)}`),

    /** Get aggregated stats for a date range. */
    getStats: (opts?: { from?: string; to?: string }) => {
      const params: Record<string, string> = {};
      if (opts?.from) params.from = opts.from;
      if (opts?.to) params.to = opts.to;
      return request<CSStats>("/api/v1/stats", params);
    },

    /**
     * Health check — HEAD request to base URL.
     * Returns { ok, latency_ms } or { ok: false, error }.
     */
    healthCheck: async (): Promise<{ ok: boolean; latency_ms: number; error?: string }> => {
      const start = Date.now();
      try {
        const res = await fetch(`${baseUrl}/api/v1/stats`, {
          method: "HEAD",
          headers: { "x-api-key": apiKey! },
          cache: "no-store",
          signal: AbortSignal.timeout(10_000),
        });
        return { ok: res.ok, latency_ms: Date.now() - start, error: res.ok ? undefined : `HTTP ${res.status}` };
      } catch (e) {
        return { ok: false, latency_ms: Date.now() - start, error: (e as Error).message };
      }
    },
  };
}
