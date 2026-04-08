import { NextResponse } from "next/server";
import { getStatus } from "@/lib/sync-state";
import { callscraperClient } from "@/lib/callscraper";

export const runtime = "nodejs";

export async function GET() {
  const sync_state = await getStatus();
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
  return NextResponse.json({ sync_state, upstream });
}
