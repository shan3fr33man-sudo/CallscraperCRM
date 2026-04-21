import { NextResponse } from "next/server";
import { crmClient } from "@/lib/crmdb";
import { verifyBridgeToken } from "@/lib/auth-bridge";

export const runtime = "nodejs";

/**
 * POST /api/auth/exchange
 *
 * Accepts a callscraper.com bridge JWT and returns the CRM context needed to
 * route the caller to the right workspace. Session establishment is handled
 * separately by `/launch` (which may set a cookie) or by the caller landing
 * on the login page with a `next=` redirect — this route itself is
 * intentionally a pure lookup.
 *
 * Body: { token: string }
 *
 * Returns:
 *   200 { ok: true, org: { id, name, slug, upstream_company_id }, claims: {...} }
 *   401 { ok: false, error, reason }        // token validation failed
 *   404 { ok: false, error: "No CRM workspace linked to this company" }
 *   409 { ok: false, error, matches: [...] } // multiple CRM orgs linked to
 *                                              // the same upstream_company_id
 *                                              // (legitimate per migration 0009)
 *
 * This route is meant to be called server-side (from /launch or from Ken's
 * side during testing). It's public (no auth required) because the bridge
 * token IS the auth.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { token?: string };
  if (!body.token) {
    return NextResponse.json({ ok: false, error: "token required" }, { status: 400 });
  }

  const outcome = verifyBridgeToken(body.token);
  if (!outcome.ok) {
    // Log the specific reason server-side for Ken's debugging, but only
    // expose a coarse "invalid" response to the caller — distinguishing
    // `bad_signature` vs `expired` vs `ttl_too_long` publicly tells an
    // attacker whether they've guessed the right secret. Ken can tail
    // server logs during integration testing; production callers get a
    // uniform 401.
    console.warn("[auth/exchange] token verify failed", { reason: outcome.reason });
    return NextResponse.json(
      { ok: false, error: "Invalid or expired link" },
      { status: 401 },
    );
  }

  const sb = crmClient();
  const { data: orgs, error } = await sb
    .from("organizations")
    .select("id, name, slug, upstream_company_id")
    .eq("upstream_company_id", outcome.claims.company_id);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  if (!orgs || orgs.length === 0) {
    // Don't reveal WHY the lookup failed — could be the company_id was
    // mistyped, the link was never established, or the org was deleted.
    // All three are equivalent from the caller's perspective.
    return NextResponse.json(
      { ok: false, error: "No CRM workspace is linked to this account yet." },
      { status: 404 },
    );
  }

  if (orgs.length > 1) {
    // Multiple CRM orgs linked — legitimate per migration 0009. The client
    // (typically /launch) must present a chooser. Return all candidates.
    return NextResponse.json(
      {
        ok: false,
        error: "Multiple CRM workspaces linked to this callscraper company_id",
        matches: orgs,
      },
      { status: 409 },
    );
  }

  return NextResponse.json({
    ok: true,
    org: orgs[0],
    claims: outcome.claims,
  });
}
