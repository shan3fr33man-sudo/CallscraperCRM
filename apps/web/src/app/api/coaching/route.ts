import { NextResponse } from "next/server";
import { crmClient, DEFAULT_ORG_ID } from "@/lib/crmdb";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const days = Number(url.searchParams.get("days") ?? 7);
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const sb = crmClient();

  const coaching = await sb
    .from("call_coaching")
    .select("id, call_id, score, rubric_json, coach_notes, reviewed_at, created_at")
    .eq("org_id", DEFAULT_ORG_ID)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(500);
  if (coaching.error) return NextResponse.json({ error: coaching.error.message }, { status: 500 });

  const callIds = (coaching.data ?? []).map((c) => c.call_id).filter(Boolean);
  let activityById = new Map<string, Record<string, unknown>>();
  if (callIds.length > 0) {
    const acts = await sb
      .from("activities")
      .select("id, record_id, payload, created_at")
      .in("id", callIds);
    activityById = new Map((acts.data ?? []).map((a) => [String(a.id), a as Record<string, unknown>]));
  }

  const customerIds = Array.from(new Set(Array.from(activityById.values()).map((a) => (a as { record_id?: string }).record_id).filter(Boolean))) as string[];
  let customerById = new Map<string, string>();
  if (customerIds.length > 0) {
    const cs = await sb.from("customers").select("id, customer_name").in("id", customerIds);
    customerById = new Map((cs.data ?? []).map((c) => [String(c.id), String(c.customer_name ?? "Unknown")]));
  }

  const rows = (coaching.data ?? []).map((c) => {
    const act = activityById.get(String(c.call_id)) as { payload?: Record<string, unknown>; record_id?: string; created_at?: string } | undefined;
    const p = act?.payload ?? {};
    const rubric = (c.rubric_json as { grade?: string; flags?: Array<{ message: string }>; improvements?: string[] }) ?? {};
    return {
      id: c.id,
      call_id: c.call_id,
      customer_name: customerById.get(String(act?.record_id ?? "")) ?? "Unknown",
      duration_seconds: (p.duration_seconds as number) ?? 0,
      call_outcome: (p.call_outcome as string) ?? null,
      brand: (p.brand as string) ?? null,
      transcript: (p.transcript as string) ?? null,
      score: Number(c.score ?? 0),
      grade: rubric.grade ?? "F",
      top_flag: rubric.flags?.[0]?.message ?? null,
      coach_notes: c.coach_notes ?? rubric.improvements?.[0] ?? null,
      strengths: (rubric as { strengths?: string[] }).strengths ?? [],
      improvements: rubric.improvements ?? [],
      flags: rubric.flags ?? [],
      reviewed_at: c.reviewed_at,
      created_at: act?.created_at ?? c.created_at,
    };
  });

  // Summary
  const scores = rows.map((r) => r.score);
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const dist: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  rows.forEach((r) => { dist[r.grade] = (dist[r.grade] ?? 0) + 1; });
  const topGrade = Object.entries(dist).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
  const needsAttention = rows.filter((r) => r.score < 65).length;

  return NextResponse.json({
    rows,
    summary: { avg, count: rows.length, top_grade: topGrade, needs_attention: needsAttention, distribution: dist },
  });
}

export async function PATCH(req: Request) {
  const body = (await req.json()) as { id: string; coach_notes?: string; mark_reviewed?: boolean };
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const sb = crmClient();
  const patch: Record<string, unknown> = {};
  if (body.coach_notes != null) patch.coach_notes = body.coach_notes;
  if (body.mark_reviewed) patch.reviewed_at = new Date().toISOString();
  const r = await sb.from("call_coaching").update(patch).eq("id", body.id).select("id").single();
  if (r.error) return NextResponse.json({ error: r.error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
