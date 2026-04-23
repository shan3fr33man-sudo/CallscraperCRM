import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { consumeJti, verifyBridgeToken } from "@/lib/auth-bridge";
import { crmClient } from "@/lib/crmdb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /launch?t=<bridgeJWT>&call_id=<callscraper-call-uuid>
 *
 * Entry point from callscraper.com's "Open in CRM" button. Validates the
 * bridge token, resolves the call_id to a CRM customer, and redirects to
 * the customer's detail page.
 *
 * Deployment:
 *   When the reverse proxy is live at callscraper.com/crm → this app,
 *   Ken's button uses `href="https://callscraper.com/crm/launch?t=...&call_id=..."`
 *   and the user never sees the CRM subdomain.
 *
 * Session handling (v1.1 scope):
 *   This page validates the bridge token but does NOT yet mint a CRM
 *   Supabase Auth session on the user's behalf. If the user isn't already
 *   logged into the CRM, they land on /login first. That's acceptable for
 *   a pilot — one extra login per session is fine while the real SSO glue
 *   is scheduled for the Integration Sprint (post-this-sprint, pre-Stripe).
 *
 * M4 (this sprint) adds:
 *   - Single-use replay protection via `bridge_jti_denylist` table.
 *   - Chooser UI for users whose upstream company_id maps to >1 CRM org.
 *
 * Known-open for v1.2 (tracked in BLOCKERS.md):
 *   - TODO v1.2: auto-mint CRM session here via
 *     supabase.auth.admin.createUser + generateLink so the user lands
 *     fully authenticated instead of being bounced to /login.
 */
export default async function LaunchPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; call_id?: string }>;
}) {
  const { t, call_id } = await searchParams;

  if (!t) {
    return (
      <LaunchError
        title="Missing token"
        detail="This link is missing its authentication token. Ask callscraper.com to generate a fresh link."
      />
    );
  }

  const outcome = verifyBridgeToken(t);
  if (!outcome.ok) {
    // Log the specific reason server-side for Ken's debugging; show a
    // uniform message to the user so a leaked URL can't be probed for
    // secret-correctness feedback (bad_signature vs expired etc).
    console.warn("[launch] token verify failed", { reason: outcome.reason });
    return (
      <LaunchError
        title="Invalid or expired link"
        detail="We couldn't verify this link. Generate a new one from callscraper.com and try again."
      />
    );
  }

  // Single-use enforcement: the jti denylist rejects a second redemption of
  // the same token. Tokens are already capped at ≤5min, so an attacker who
  // scrapes a URL from a shoulder-surf or log still has to win a race; this
  // closes that race. We consume BEFORE the org lookup so a replay attempt
  // can't be used to probe workspace-linkage state either.
  const consume = await consumeJti(
    outcome.claims.jti,
    outcome.claims.company_id,
    outcome.claims.exp,
  );
  if (!consume.ok) {
    if (consume.reason === "replay") {
      console.warn("[launch] replay attempt", {
        jti: outcome.claims.jti,
        company_id: outcome.claims.company_id,
      });
      return (
        <LaunchError
          title="This link was already used"
          detail="Bridge links are single-use for security. Head back to callscraper.com and click 'Open in CRM' again to generate a fresh one."
        />
      );
    }
    // reason === "system": surface a retryable error instead of a
    // mis-labeled replay card.
    return (
      <LaunchError
        title="CRM is temporarily unavailable"
        detail="CRM is temporarily unavailable. Please try again shortly."
      />
    );
  }

  const sb = crmClient();

  // Resolve the organization linked to this callscraper company_id
  const { data: orgs } = await sb
    .from("organizations")
    .select("id, name, slug, upstream_company_id")
    .eq("upstream_company_id", outcome.claims.company_id);

  if (!orgs || orgs.length === 0) {
    return (
      <LaunchError
        title="No CRM workspace linked"
        detail="This callscraper workspace isn't connected to a CRM yet. Sign up or link one in Settings → Integrations → Callscraper."
        cta={{ href: "/signup", label: "Set up CRM" }}
      />
    );
  }

  if (orgs.length > 1) {
    // Multi-org: forward to the chooser. We do NOT pass the token in the URL
    // anymore (bookmarkable / shareable leaks workspace info). Instead, we
    // set a short-lived, httpOnly server cookie scoped to the chooser path
    // and redirect without query params. The chooser reads the jti from the
    // cookie and looks up the already-consumed denylist row to recover
    // company_id.
    const jar = await cookies();
    jar.set({
      name: "crm_chooser",
      value: outcome.claims.jti,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/launch/choose-org",
      maxAge: 30,
    });
    redirect("/launch/choose-org");
  }

  const orgId = orgs[0].id;

  // If a call_id was supplied, resolve it to the linked customer via the
  // activities table (sync writes activities.payload.external_id = call_id).
  if (call_id) {
    const { data: activity } = await sb
      .from("activities")
      .select("record_id")
      .eq("org_id", orgId)
      .eq("kind", "call")
      .eq("payload->>external_id", String(call_id))
      .limit(1)
      .maybeSingle();

    if (activity?.record_id) {
      // TODO v1.2: call supabase.auth.admin.createUser + generateLink here
      // so the redirect lands the user inside an authenticated session.
      // For M4 pilot, middleware redirects to /login first — acceptable.
      redirect(`/customers/${activity.record_id as string}`);
    }
    // Fall through to the org home if we couldn't resolve the call.
  }

  // TODO v1.2: call supabase.auth.admin.createUser + generateLink here
  // so the redirect lands the user inside an authenticated session.
  // No call_id or unresolved — land on the home page of the CRM.
  redirect("/");
}

function LaunchError({
  title,
  detail,
  cta,
}: {
  title: string;
  detail: string;
  cta?: { href: string; label: string };
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-bg">
      <div className="max-w-md text-center">
        <div className="text-lg font-semibold mb-2 text-text">{title}</div>
        <div className="text-sm text-muted">{detail}</div>
        {cta ? (
          <a
            href={cta.href}
            className="inline-flex items-center gap-1 mt-4 text-sm bg-accent text-white px-3 py-1.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            {cta.label}
          </a>
        ) : null}
      </div>
    </div>
  );
}
