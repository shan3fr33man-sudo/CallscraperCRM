import { NextResponse } from "next/server";
import { callscraperClient } from "@/lib/callscraper";

export const runtime = "nodejs";

export async function GET() {
  try {
    const sb = callscraperClient();
    const { data: calls, error } = await sb
      .from("calls")
      .select("id,from_number,to_number,duration_seconds,call_outcome,brand,started_at,resolved_name,caller_name,direction")
      .order("started_at", { ascending: false })
      .limit(20);
    if (error) return NextResponse.json({ calls: [], error: error.message });
    const ids = (calls ?? []).map((c) => c.id);
    const { data: summaries } = ids.length
      ? await sb.from("call_summaries").select("call_id,lead_quality,intent,move_type,move_date,price_quoted").in("call_id", ids)
      : { data: [] as Array<Record<string, unknown>> };
    const byCall = new Map((summaries ?? []).map((s) => [s.call_id as string, s]));
    const out = (calls ?? []).map((c) => {
      const s = byCall.get(c.id);
      return {
        id: c.id,
        caller_name: c.resolved_name ?? c.caller_name ?? c.from_number ?? "Unknown",
        from_number: c.from_number,
        duration_seconds: c.duration_seconds,
        call_outcome: c.call_outcome,
        brand: c.brand,
        direction: c.direction,
        started_at: c.started_at,
        lead_quality: s?.lead_quality ?? null,
        intent: s?.intent ?? null,
        move_type: s?.move_type ?? null,
        move_date: s?.move_date ?? null,
        price_quoted: s?.price_quoted ?? null,
        has_summary: !!s,
      };
    });
    return NextResponse.json({ calls: out });
  } catch (e) {
    return NextResponse.json({ calls: [], error: (e as Error).message });
  }
}
