import { NextResponse } from "next/server";
import { verifyWritebackToken } from "@/lib/auth-bridge";
import { crmClient } from "@/lib/crmdb";

export const runtime = "nodejs";

/**
 * POST /api/callscraper/writeback?t=<v1w_token>
 *
 * Inbound from callscraper.com. The caller (callscraper's backend) mints a
 * short-lived `v1w.` writeback token carrying { call_id, company_id, exp }
 * and calls this endpoint to ask "what CRM status should I render on the
 * call card?" The CRM resolves the call_id to a customer via the
 * `activities` table, then rolls up badge state from opportunities,
 * invoices, and tickets.
 *
 * Design:
 * - Always responds JSON. Always sets `cache-control: no-store` so a proxy
 *   can't serve stale status to a different caller.
 * - 401 on any token failure with a coarse reason (don't leak why — same
 *   philosophy as `/launch`).
 * - 404 when the token's company_id doesn't map to a CRM org.
 * - 200 with `{ badges: [] }` when the call resolves but nothing notable
 *   exists yet. Empty badges is a valid state; callers should render a
 *   neutral card.
 *
 * Badge heuristic (capped at 3 total):
 *   1. Any opportunity for the customer:
 *      - status='booked' → "Booked · $X" (green), X = max amount
 *      - status='quoted' → "Quoted · $X" (blue)
 *      - else → "Active opportunity" (blue)
 *   2. Any invoice.status='overdue' → "Overdue invoice" (red)
 *   3. Any active, priority>=3 tickets → "N open tickets" (amber)
 */

type BadgeTone = "green" | "red" | "amber" | "blue" | "muted";

interface Badge {
  label: string;
  tone: BadgeTone;
  link?: string;
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export async function POST(req: Request) {
  // 1. Extract and verify the token.
  const url = new URL(req.url);
  const token = url.searchParams.get("t");
  const outcome = verifyWritebackToken(token);
  if (!outcome.ok) {
    // Coarse reason — callers should treat 401 as "mint a fresh token".
    console.warn("[writeback] token verify failed", { reason: outcome.reason });
    return json({ ok: false, error: "Invalid or expired token" }, 401);
  }
  const { call_id, company_id } = outcome.claims;

  // 2. Parse body (call_id is also in the token; body shape retained for
  //    forward-compat with richer payloads).
  let body: { call_id?: string } = {};
  try {
    body = (await req.json()) as { call_id?: string };
  } catch {
    // Empty body is fine — the token carries call_id.
  }
  // Body call_id, if supplied, must match the token. Cross-binding guard:
  // a valid token cannot be combined with an arbitrary call_id body.
  if (typeof body.call_id === "string" && body.call_id !== call_id) {
    return json({ ok: false, error: "call_id mismatch" }, 401);
  }

  const sb = crmClient();

  // 3. Resolve company_id → CRM org_id.
  const { data: orgs } = await sb
    .from("organizations")
    .select("id")
    .eq("upstream_company_id", company_id)
    .limit(1);
  if (!orgs || orgs.length === 0) {
    return json({ ok: false, error: "No CRM workspace linked" }, 404);
  }
  const orgId = orgs[0].id as string;

  // 4. Resolve call_id → customer_id via activities (kind='call', payload
  //    holds the upstream identifier). We use the same `external_id` column
  //    that `/launch` and the sync pipeline use (see INTEGRATION.md). The
  //    spec refers to `call_id` as the JSON key name; the existing codebase
  //    writes it under `external_id` in activities.payload, so we check both
  //    to be defensive against a naming drift.
  //
  //    Defense-in-depth: validate call_id shape before interpolating into the
  //    PostgREST `.or()` filter. The token is HMAC-signed, but a leaked secret
  //    would let the holder mint arbitrary call_id strings with commas, dots,
  //    or PostgREST operators that could alter the filter semantics.
  const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  if (!UUID_RE.test(call_id)) {
    return json({ error: "invalid call_id format" }, 400);
  }
  const { data: activity } = await sb
    .from("activities")
    .select("record_id")
    .eq("org_id", orgId)
    .eq("kind", "call")
    .or(`payload->>external_id.eq.${call_id},payload->>call_id.eq.${call_id}`)
    .limit(1)
    .maybeSingle();

  if (!activity?.record_id) {
    // Call isn't in CRM yet (sync window or unknown number). Return empty
    // badges — callers should render a neutral card.
    return json({ badges: [] }, 200);
  }
  const customerId = activity.record_id as string;

  // 5. Pull the state we need, then compose badges in a fixed priority order.
  const [oppsRes, invsRes, tixRes] = await Promise.all([
    sb
      .from("opportunities")
      .select("id, status, amount")
      .eq("org_id", orgId)
      .eq("customer_id", customerId),
    // Overdue = past due_date with outstanding balance. Migration 0007's
    // trigger does populate status='overdue', but ONLY when a payment event
    // fires on the invoice. An invoice with no payments whose due_date just
    // passed stays in status='sent' until the next payment (or never, if
    // there's never a payment). So we compute overdue dynamically from
    // due_date + balance instead of trusting the stored status, and include
    // 'overdue' in the status filter to catch invoices the trigger already
    // marked.
    sb
      .from("invoices")
      .select("id, status, due_date, balance")
      .eq("org_id", orgId)
      .eq("customer_id", customerId)
      .lt("due_date", new Date().toISOString())
      .gt("balance", 0)
      .in("status", ["sent", "partial", "overdue"]),
    sb
      .from("tickets")
      .select("id, status, priority")
      .eq("org_id", orgId)
      .eq("customer_id", customerId),
  ]);

  const opps = (oppsRes.data ?? []) as Array<{ id: string; status: string | null; amount: number | null }>;
  // invsRes is already filtered to overdue-qualifying rows (past due, balance>0,
  // status in sent/partial/overdue). Any row here counts as overdue.
  const invs = (invsRes.data ?? []) as Array<{ id: string; status: string | null; due_date: string | null; balance: number | null }>;
  const tix = (tixRes.data ?? []) as Array<{ id: string; status: string | null; priority: number | null }>;

  const customerLink = `/customers/${customerId}`;
  const badges: Badge[] = [];

  // Opportunity badge (one total, picked by priority).
  const booked = opps.filter((o) => o.status === "booked");
  const quoted = opps.filter((o) => o.status === "quoted");
  if (booked.length > 0) {
    const maxAmount = Math.max(0, ...booked.map((o) => Number(o.amount ?? 0)));
    badges.push({
      label: `Booked · $${formatAmount(maxAmount)}`,
      tone: "green",
      link: customerLink,
    });
  } else if (quoted.length > 0) {
    const maxAmount = Math.max(0, ...quoted.map((o) => Number(o.amount ?? 0)));
    badges.push({
      label: `Quoted · $${formatAmount(maxAmount)}`,
      tone: "blue",
      link: customerLink,
    });
  } else if (opps.length > 0) {
    badges.push({ label: "Active opportunity", tone: "blue", link: customerLink });
  }

  // Overdue invoice badge. Query already pre-filtered to past-due rows with
  // an outstanding balance, so any row here is overdue regardless of status.
  if (invs.length > 0) {
    badges.push({ label: "Overdue invoice", tone: "red", link: customerLink });
  }

  // High-priority open ticket badge.
  const openHighPriority = tix.filter(
    (t) => t.status === "active" && typeof t.priority === "number" && (t.priority ?? 0) >= 3,
  );
  if (openHighPriority.length > 0) {
    const n = openHighPriority.length;
    badges.push({
      label: `${n} open ticket${n === 1 ? "" : "s"}`,
      tone: "amber",
      link: customerLink,
    });
  }

  // Cap at 3 badges (spec).
  return json({ badges: badges.slice(0, 3) }, 200);
}

function formatAmount(n: number): string {
  // Whole-dollar formatting with thousands separators. No cents — badges
  // should stay scannable on a narrow call card.
  return Math.round(n).toLocaleString("en-US");
}
