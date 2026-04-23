import { createServerSupabase } from "./supabase/server";
import { DEFAULT_ORG_ID } from "./crmdb";

/**
 * Returns the org_id for the current authenticated user.
 * Falls back to DEFAULT_ORG_ID for:
 *   - Unauthenticated requests (cron routes, public webhooks)
 *   - New users whose org hasn't been created yet
 *   - Any error condition (never crashes a route)
 *
 * Cron routes (/api/sync/*, /api/agents/*) INTENTIONALLY use
 * DEFAULT_ORG_ID directly — they run as the system.
 */
export async function getOrgId(): Promise<string> {
  try {
    const sb = await createServerSupabase();
    const { data: userRes, error } = await sb.auth.getUser();
    if (error || !userRes?.user) return DEFAULT_ORG_ID;

    const { data: membership } = await sb
      .from("memberships")
      .select("org_id")
      .eq("user_id", userRes.user.id)
      .maybeSingle();

    return (membership?.org_id as string | undefined) ?? DEFAULT_ORG_ID;
  } catch {
    return DEFAULT_ORG_ID;
  }
}

export async function getCurrentUser() {
  try {
    const sb = await createServerSupabase();
    const { data } = await sb.auth.getUser();
    return data?.user ?? null;
  } catch {
    return null;
  }
}

/**
 * For routes that REQUIRE authentication.
 * Throws a Response (401) if unauthenticated — catch with `if (res instanceof Response) return res`.
 */
export async function requireAuth(): Promise<{
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
  orgId: string;
}> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Response(JSON.stringify({ error: "Authentication required" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  const orgId = await getOrgId();
  return { user, orgId };
}

/**
 * Strict version of getOrgId — throws if the user isn't authenticated or
 * has no membership. Use this in routes where the default-org fallback
 * would be a bug (e.g., settings writes, destructive ops). Legacy routes
 * that intentionally want the fallback (cron, public webhooks) continue
 * to use `getOrgId()`.
 */
export async function requireOrgId(): Promise<string> {
  const sb = await createServerSupabase();
  const { data: userRes } = await sb.auth.getUser();
  if (!userRes?.user) {
    throw new Response(JSON.stringify({ error: "Authentication required" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  const { data: membership } = await sb
    .from("memberships")
    .select("org_id")
    .eq("user_id", userRes.user.id)
    .maybeSingle();
  const orgId = membership?.org_id as string | undefined;
  if (!orgId) {
    throw new Response(JSON.stringify({ error: "No org membership for user" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  return orgId;
}
