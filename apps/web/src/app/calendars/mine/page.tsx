import { getCurrentUser } from "@/lib/auth";
import { MineCalendarClient } from "./mine-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /calendars/mine — personal office calendar for the signed-in user.
 *
 * Server component wrapper so we can look up the current user's UUID
 * on the server (no /api/me needed) and force owner_id filtering client-side.
 * If the middleware lets an unauthenticated request through (e.g. DEFAULT_ORG
 * mode with no Supabase session), we fall back to showing nothing scoped — the
 * client still renders an empty-state so the page is never blank.
 */
export default async function MineCalendarPage() {
  const user = await getCurrentUser();
  // getCurrentUser returns null when there's no Supabase session (local dev
  // with DEFAULT_ORG, etc.). In that case we show the empty view rather than
  // redirect — the middleware already redirects unauthenticated requests on
  // most paths, so if we got here without a user we're in a permissive mode.
  return <MineCalendarClient userId={user?.id ?? null} />;
}
