import { redirect } from "next/navigation";
import { verifyBridgeToken } from "@/lib/auth-bridge";
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
 * Known-open for v1.2 (tracked in BLOCKERS.md):
 *   - Auto-mint CRM session from bridge claims via supabase.auth.admin
 *   - Chooser UI when multiple orgs match the upstream_company_id
 *   - Single-use token replay protection via a jti denylist table
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
    // v1.1: pick the most recently updated org. v1.2 will add a chooser UI.
    console.warn("[launch] multiple orgs linked to company_id; picking first", {
      company_id: outcome.claims.company_id,
      orgs: orgs.map((o) => o.id),
    });
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
      redirect(`/customers/${activity.record_id as string}`);
    }
    // Fall through to the org home if we couldn't resolve the call.
  }

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
