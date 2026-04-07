import { NextResponse } from "next/server";
import { callscraperClient } from "@/lib/callscraper";

export const runtime = "nodejs";

/**
 * Universal search across calls, summaries, transcripts, leads.
 * Uses Postgres ilike + the existing tsvector on call_summaries.search_vector.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ calls: [], leads: [] });

  const sb = callscraperClient();
  const ilike = `%${q}%`;

  const [callsRes, summariesRes, leadsRes] = await Promise.all([
    sb
      .from("calls")
      .select("id,date,from_number,resolved_name,caller_name,brand,duration_seconds,call_outcome")
      .or(`from_number.ilike.${ilike},to_number.ilike.${ilike},resolved_name.ilike.${ilike},caller_name.ilike.${ilike}`)
      .order("date", { ascending: false })
      .limit(25),
    sb
      .from("call_summaries")
      .select("call_id,customer_name,customer_phone,summary,call_summary,move_type,price_quoted,lead_quality")
      .or(`summary.ilike.${ilike},call_summary.ilike.${ilike},customer_name.ilike.${ilike},transcript.ilike.${ilike}`)
      .limit(25),
    sb
      .from("leads")
      .select("id,created_at,customer_name,customer_phone,customer_email,brand")
      .or(`customer_name.ilike.${ilike},customer_phone.ilike.${ilike},customer_email.ilike.${ilike}`)
      .order("created_at", { ascending: false })
      .limit(25),
  ]);

  // Merge call hits + calls referenced by summary hits
  const callMap = new Map<string, unknown>();
  for (const c of callsRes.data ?? []) callMap.set((c as { id: string }).id, c);

  const summaryCallIds = (summariesRes.data ?? [])
    .map((s) => (s as { call_id: string | null }).call_id)
    .filter((x): x is string => !!x);
  if (summaryCallIds.length) {
    const { data: extra } = await sb
      .from("calls")
      .select("id,date,from_number,resolved_name,caller_name,brand,duration_seconds,call_outcome")
      .in("id", summaryCallIds);
    for (const c of extra ?? []) callMap.set((c as { id: string }).id, c);
  }

  return NextResponse.json({
    query: q,
    calls: [...callMap.values()],
    summaries: summariesRes.data ?? [],
    leads: leadsRes.data ?? [],
  });
}
