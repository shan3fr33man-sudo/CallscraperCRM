import { NextResponse } from "next/server";
import { callscraperClient } from "@/lib/callscraper";
import { crmClient, DEFAULT_ORG_ID } from "@/lib/crmdb";

export const runtime = "nodejs";

/**
 * Background runner: find recent calls that haven't been triaged by Claude yet
 * and run analyze-call on each. Designed to be hit by an external cron
 * (Vercel cron, Supabase scheduled function, GitHub Actions, etc.).
 *
 * Query params:
 *   ?limit=10  (default 5, max 25)
 *   ?days=2    (default 1)
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "5", 10), 25);
  const days = parseInt(url.searchParams.get("days") ?? "1", 10);

  const sb = callscraperClient();
  const since = new Date(Date.now() - days * 86400000).toISOString();

  // 1) Recent calls
  const { data: calls, error } = await sb
    .from("calls")
    .select("id")
    .gte("date", since)
    .order("date", { ascending: false })
    .limit(limit * 3); // overfetch since some will already be triaged
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 2) Filter out ones we already analyzed
  const crm = crmClient();
  const ids = (calls ?? []).map((c) => (c as { id: string }).id);
  const { data: existing } = await crm
    .from("agent_runs")
    .select("subject_external_id")
    .eq("org_id", DEFAULT_ORG_ID)
    .eq("agent_name", "Lead Triage")
    .in("subject_external_id", ids);
  const done = new Set((existing ?? []).map((r) => (r as { subject_external_id: string }).subject_external_id));
  const todo = ids.filter((id) => !done.has(id)).slice(0, limit);

  // 3) Fire analyze-call for each (sequential to keep rate-limits sane)
  const origin = url.origin;
  const results: { id: string; ok: boolean; error?: string }[] = [];
  for (const id of todo) {
    try {
      const r = await fetch(`${origin}/api/agents/analyze-call`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ call_id: id }),
      });
      const j = await r.json();
      results.push({ id, ok: r.ok, error: j.error });
    } catch (e) {
      results.push({ id, ok: false, error: (e as Error).message });
    }
  }

  return NextResponse.json({
    scanned: ids.length,
    triaged: results.filter((r) => r.ok).length,
    skipped: ids.length - todo.length,
    results,
  });
}

export async function GET(req: Request) {
  return POST(req);
}
