/**
 * SmartMoving Premium API client.
 *
 * One client instance per brand (API key). The historical sync holds two
 * instances: `new SmartMovingClient({ apiKey: env.SMARTMOVING_API_KEY_APEX_MOVER })`
 * and the equivalent for Affordable Movers.
 *
 * Rate limiting is applied at request time via a shared token bucket (see
 * rate-limiter.ts) so multiple clients in the same process don't collectively
 * exceed the per-minute ceiling.
 *
 * The exact endpoint paths follow the convention used by callscraper.com v3
 * (`/premium/opportunities/...`). The real base URL + path shape will be
 * confirmed against a live 200 response during the Phase 1 smoke test; until
 * then both are constructor options with sensible defaults.
 */
import {
  opportunityDetailSchema,
  type OpportunityDetail,
} from "./schemas";
import { defaultLimiter, type RateLimiter } from "./rate-limiter";

export interface SmartMovingClientOpts {
  /** Premium API key (required). Sent as `x-api-key`. */
  apiKey: string;
  /** Provider Key for third-party integration scoping (optional). Sent as `x-provider-key`. */
  providerKey?: string;
  /** Client / tenant identifier (optional). Sent as `x-client-id`. */
  clientId?: string;
  baseUrl?: string;
  limiter?: RateLimiter;
  /** Number of retries for 429/5xx before giving up. */
  maxRetries?: number;
}

export class SmartMovingClient {
  private readonly apiKey: string;
  private readonly providerKey?: string;
  private readonly clientId?: string;
  private readonly baseUrl: string;
  private readonly limiter: RateLimiter;
  private readonly maxRetries: number;

  constructor(opts: SmartMovingClientOpts) {
    if (!opts.apiKey) throw new Error("SmartMovingClient: apiKey required");
    this.apiKey = opts.apiKey;
    this.providerKey = opts.providerKey;
    this.clientId = opts.clientId;
    // SmartMoving APIM uses segment versioning — every operation lives under
    // /v1/api/... Confirmed 2026-04-22 by inspecting the developer portal's
    // apiVersionSet metadata (versioningScheme="Segment"). The base URL here
    // includes /v1; callers pass paths like "/api/branches".
    this.baseUrl = (opts.baseUrl ?? "https://api-public.smartmoving.com/v1").replace(/\/+$/, "");
    this.limiter = opts.limiter ?? defaultLimiter;
    this.maxRetries = opts.maxRetries ?? 3;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    let attempt = 0;
    let lastError: unknown;
    const headers: Record<string, string> = {
      "x-api-key": this.apiKey,
      accept: "application/json",
      "content-type": "application/json",
    };
    if (this.providerKey) headers["x-provider-key"] = this.providerKey;
    if (this.clientId) headers["x-client-id"] = this.clientId;
    while (attempt <= this.maxRetries) {
      await this.limiter.acquire();
      try {
        const res = await fetch(url, {
          ...init,
          headers: {
            ...headers,
            ...(init?.headers ?? {}),
          },
        });
        if (res.status === 429 || res.status >= 500) {
          const backoff = Math.min(30_000, 500 * 2 ** attempt);
          await sleep(backoff);
          attempt++;
          continue;
        }
        if (!res.ok) {
          const body = await res.text();
          throw new SmartMovingApiError(res.status, `${path} failed: ${body}`);
        }
        return (await res.json()) as T;
      } catch (err) {
        if (err instanceof SmartMovingApiError) throw err;
        lastError = err;
        const backoff = Math.min(30_000, 500 * 2 ** attempt);
        await sleep(backoff);
        attempt++;
      }
    }
    throw new SmartMovingApiError(0, `${path} failed after ${this.maxRetries} retries`, lastError);
  }

  /**
   * Page through the `/api/customers` list. SmartMoving does NOT expose a
   * list-opportunities endpoint; historical opportunity harvesting goes:
   *   customers → customers/{id}/opportunities → opportunities/{id}
   *
   * Yields customer IDs. The caller drives the opportunity walk per customer.
   * Pagination via `?page=N&pageSize=M` (1-indexed per SM convention).
   */
  async *listCustomers(opts: {
    maxItems?: number;
    pageSize?: number;
    startPage?: number;
  } = {}): AsyncGenerator<{ id: string; raw: Record<string, unknown> }> {
    const pageSize = opts.pageSize ?? 100;
    let page = opts.startPage ?? 1;
    let yielded = 0;
    const max = opts.maxItems ?? Number.POSITIVE_INFINITY;
    while (yielded < max) {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      const body = await this.request<unknown>(`/api/customers?${qs}`);
      const items = unwrapList(body);
      if (items.length === 0) break;
      for (const item of items) {
        const id = (item as Record<string, unknown>).id as string | undefined;
        if (!id) continue;
        yield { id, raw: item as Record<string, unknown> };
        yielded += 1;
        if (yielded >= max) break;
      }
      if (items.length < pageSize) break;
      page += 1;
    }
  }

  /** Opportunities for a customer. Returns list-style summaries (no charges). */
  async listCustomerOpportunities(customerId: string): Promise<Array<Record<string, unknown>>> {
    const body = await this.request<unknown>(
      `/api/customers/${encodeURIComponent(customerId)}/opportunities`,
    );
    return unwrapList(body);
  }

  /** Full opportunity detail — feeds historical_jobs.raw_payload. */
  async getOpportunity(id: string): Promise<OpportunityDetail> {
    const raw = await this.request<unknown>(`/api/opportunities/${encodeURIComponent(id)}`);
    return opportunityDetailSchema.parse(raw);
  }

  /** List branches (brands) configured in the SM tenant. */
  async listBranches(): Promise<Array<Record<string, unknown>>> {
    const body = await this.request<unknown>(`/api/branches`);
    return unwrapList(body);
  }

  /** Liveness check — returns the SM build number string. Does not count against quota. */
  async ping(): Promise<string> {
    return await this.request<string>(`/api/ping`);
  }
}

export class SmartMovingApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "SmartMovingApiError";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Unwrap a SmartMoving list response. Their External API sometimes returns
 * a bare array, sometimes `{ pageResults: [...] }` or `{ items: [...] }`.
 * Handles all three so callers don't have to guess.
 */
function unwrapList(body: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(body)) return body as Array<Record<string, unknown>>;
  if (body && typeof body === "object") {
    const obj = body as Record<string, unknown>;
    for (const key of ["pageResults", "items", "data", "results", "value"]) {
      const v = obj[key];
      if (Array.isArray(v)) return v as Array<Record<string, unknown>>;
    }
  }
  return [];
}
