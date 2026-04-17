import { NextResponse } from "next/server";
import { getStatus } from "@/lib/sync-state";
import { callscraperClient } from "@/lib/callscraper";
import { crmClient, DEFAULT_ORG_ID } from "@/lib/crmdb";

export const runtime = "nodejs";

export async function GET() {
  const sync_state = await getStatus();

  // Upstream counts
  let upstream = { calls: 0, call_summaries: 0, leads: 0 };
  try {
    const cs = callscraperClient();
    const [c, s, l] = await Promise.all([
      cs.from("calls").select("id", { count: "exact", head: true }),
      cs.from("call_summaries").select("id", { count: "exact", head: true }),
      cs.from("leads").select("id", { count: "exact", head: true }),
    ]);
    upstream = { calls: c.count ?? 0, call_summaries: s.count ?? 0, leads: l.count ?? 0 };
  } catch {
    // env not set — return zeros
  }

  // CRM-side counts
  let crm = { customers: 0, activities: 0, opportunities: 0 };
  try {
    const sb = crmClient();
    const [cust, act, opp] = await Promise.all([
      sb.from("customers").select("id", { count: "exact", head: true }).eq("org_id", DEFAULT_ORG_ID),
      sb.from("activities").select("id", { count: "exact", head: true }).eq("org_id", DEFAULT_ORG_ID).eq("kind", "call"),
      sb.from("opportunities").select("id", { count: "exact", head: true }).eq("org_id", DEFAULT_ORG_ID),
    ]);
    crm = { customers: cust.count ?? 0, activities: act.count ?? 0, opportunities: opp.count ?? 0 };
  } catch {
    // fallback
  }

  return NextResponse.json({ sync_state, upstream, crm });
}
