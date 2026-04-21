import { NextResponse } from "next/server";
import { crmClient } from "@/lib/crmdb";
import { getOrgId } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * GET /api/trucks — list trucks for the current org.
 *
 * Mirrors /api/crews. Used by the dispatch command center's crew-picker
 * popover (F3) so dispatchers can assign trucks to jobs without leaving
 * the board. Ordered by name for stable dropdown rendering.
 *
 * Returns empty array on any error rather than 500 so a transient DB hiccup
 * doesn't block the whole dispatch board from rendering.
 */
export async function GET() {
  const sb = crmClient();
  const orgId = await getOrgId();
  const { data, error } = await sb
    .from("trucks")
    .select("id,name,capacity")
    .eq("org_id", orgId)
    .order("name")
    .limit(200);
  if (error) {
    // Log for dev/prod debugging without crashing the caller. The dispatch
    // board already handles {trucks:[]} gracefully (empty-state copy +
    // "Configure fleet" link) so a transient outage only degrades, never
    // blocks.
    console.error("GET /api/trucks failed:", error.message);
    return NextResponse.json({ trucks: [] });
  }
  return NextResponse.json({ trucks: data ?? [] });
}
