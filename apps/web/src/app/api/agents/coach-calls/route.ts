import { NextResponse } from "next/server";
import { crmClient, DEFAULT_ORG_ID } from "@/lib/crmdb";
import { scoreCall } from "@/lib/coaching-rubric";

export const runtime = "nodejs";
export const maxDuration = 300;

type ActRow = { id: string; payload: Record<string, unknown> | null; created_at: string; record_id: string | null };

export async function POST() {
  const sb = crmClient();

  // Uncoached calls from the last 25 hours
  const since = new Date(Date.now() - 25 * 3600 * 1000).toISOString();

  // Fetch candidate activities
  const acts = await sb
    .from("activities")
    .select("id, payload, created_at, record_id")
    .eq("org_id", DEFAULT_ORG_ID)
    .eq("kind", "call")
    .gte("created_at", since)
    .limit(500);
  if (acts.error) return NextResponse.json({ error: acts.error.message }, { status: 500 });

  const candidateIds = (acts.data ?? []).map((a) => a.id);
  if (candidateIds.length === 0) return NextResponse.json({ coached: 0, avg_score: 0, top_flag: null });

  // Already-coached call_ids in this set
  const existing = await sb.from("call_coaching").select("call_id").in("call_id", candidateIds);
  const coachedSet = new Set((existing.data ?? []).map((r) => String(r.call_id)));

  const toCoach: ActRow[] = ((acts.data ?? []) as unknown as ActRow[]).filter((a) => !coachedSet.has(a.id)).slice(0, 100);

  let totalScore = 0;
  const flagCounts = new Map<string, number>();
  const inserts: Array<Record<string, unknown>> = [];

  for (const a of toCoach) {
    const p = a.payload ?? {};
    const result = scoreCall({
      call_id: a.id,
      transcript: (p.transcript as string) ?? null,
      duration_seconds: Number(p.duration_seconds ?? 0),
      call_outcome: (p.call_outcome as string) ?? null,
      lead_quality: (p.lead_quality as string) ?? null,
      intent: (p.intent as string) ?? null,
      action_items: p.action_items ?? null,
    });
    totalScore += result.score;
    result.flags.forEach((f) => flagCounts.set(f.message, (flagCounts.get(f.message) ?? 0) + 1));
    inserts.push({
      org_id: DEFAULT_ORG_ID,
      call_id: a.id,
      agent_ext: (p.agent_ext as string) ?? null,
      score: result.score,
      rubric_json: { grade: result.grade, flags: result.flags, strengths: result.strengths, improvements: result.improvements },
      coach_notes: result.improvements[0] ?? null,
    });
  }

  if (inserts.length > 0) {
    const ins = await sb.from("call_coaching").insert(inserts);
    if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 500 });
  }

  const topFlag = Array.from(flagCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const avg = inserts.length ? Math.round(totalScore / inserts.length) : 0;
  return NextResponse.json({ coached: inserts.length, avg_score: avg, top_flag: topFlag });
}

export async function GET() {
  return POST();
}
