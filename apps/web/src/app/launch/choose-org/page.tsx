import { cookies } from "next/headers";
import { crmClient } from "@/lib/crmdb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /launch/choose-org
 *
 * Chooser UI for users whose upstream callscraper company_id is linked to
 * more than one CRM organization. Reached from /launch when it sees >1
 * match.
 *
 * Handoff is via a short-lived httpOnly cookie (`crm_chooser=<jti>`) set
 * by /launch. We do NOT accept a token in the URL — a bookmarkable chooser
 * link would let anyone who saw the URL enumerate workspaces. The jti is
 * looked up in `bridge_jti_denylist` (which was populated by /launch when
 * it consumed the token) to recover the trusted `company_id`. The cookie
 * is best-effort deleted after read.
 *
 * TODO v1.2: "Open →" should actually mint a session scoped to the chosen
 * org via supabase.auth.admin + set a selected-org cookie. For the pilot
 * it simply links into `/?selected_org=<id>` — the middleware falls back
 * to /login if the user isn't already signed in.
 */
export default async function ChooseOrgPage() {
  const jar = await cookies();
  const jti = jar.get("crm_chooser")?.value;

  if (!jti) {
    return (
      <ChooserError
        title="Missing token"
        detail="This chooser link has expired. Please try again from callscraper.com."
      />
    );
  }

  const sb = crmClient();

  // Recover the trusted company_id from the denylist row that /launch wrote
  // when it consumed the bridge token. The jti is only produced by a verified
  // signature, so the mapping jti→company_id is trustworthy.
  const { data: denylistRow } = await sb
    .from("bridge_jti_denylist")
    .select("company_id")
    .eq("jti", jti)
    .maybeSingle();

  // Best-effort: delete the cookie so a second visit to this page fails
  // closed. Server components can set/delete cookies in Next 15+.
  try {
    jar.delete("crm_chooser");
  } catch {
    // noop — cookie deletion in server components is advisory; the 30s
    // maxAge already bounds exposure.
  }

  if (!denylistRow?.company_id) {
    return (
      <ChooserError
        title="Missing token"
        detail="This chooser link has expired. Please try again from callscraper.com."
      />
    );
  }

  const companyId = denylistRow.company_id as string;

  const { data: orgs } = await sb
    .from("organizations")
    .select("id, name, slug")
    .eq("upstream_company_id", companyId);

  if (!orgs || orgs.length === 0) {
    return (
      <ChooserError
        title="No CRM workspace linked"
        detail="This callscraper workspace isn't connected to a CRM yet."
      />
    );
  }

  // Per-org membership counts. Small N (usually 2-5) so a N+1 pattern is
  // fine; if this ever grows, swap for a single grouped query.
  const orgIds = orgs.map((o) => o.id as string);
  const memberCounts = new Map<string, number>();
  await Promise.all(
    orgIds.map(async (id) => {
      const { count } = await sb
        .from("memberships")
        .select("user_id", { count: "exact", head: true })
        .eq("org_id", id);
      memberCounts.set(id, count ?? 0);
    }),
  );

  return (
    <div className="min-h-screen bg-bg px-6 py-12">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-text mb-2">Choose a workspace</h1>
          <p className="text-sm text-muted">
            Your callscraper account is linked to {orgs.length} CRM workspaces. Pick the one you want to open.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {orgs.map((o) => {
            const id = o.id as string;
            const name = (o.name as string | null) ?? (o.slug as string | null) ?? id;
            const count = memberCounts.get(id) ?? 0;
            return (
              <div
                key={id}
                className="bg-panel border border-border rounded-lg p-4 flex flex-col gap-3"
              >
                <div>
                  <div className="text-base font-medium text-text truncate">{name}</div>
                  <div className="text-xs text-muted mt-1">
                    members: {count}
                  </div>
                </div>
                <div className="mt-auto">
                  <a
                    href={`/?selected_org=${encodeURIComponent(id)}`}
                    className="inline-flex items-center gap-1 text-sm bg-accent text-white px-3 py-1.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                  >
                    Open &rarr;
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ChooserError({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-bg">
      <div className="max-w-md text-center">
        <div className="text-lg font-semibold mb-2 text-text">{title}</div>
        <div className="text-sm text-muted">{detail}</div>
      </div>
    </div>
  );
}
