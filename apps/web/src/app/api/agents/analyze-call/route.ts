import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { callscraperClient } from "@/lib/callscraper";
import { crmClient, DEFAULT_ORG_ID } from "@/lib/crmdb";

export const runtime = "nodejs";

const SYSTEM = `You are the Lead Triage agent for a moving company.

For the given call, return a single JSON object with these fields:
- lead_quality: "hot" | "warm" | "cold"
- stage: "new" | "qualified" | "quoted" | "won" | "lost"
- score: integer 0-100
- one_line_summary: string (max 140 chars)
- next_best_action: string (concrete next step in <= 20 words)
- followup_text: string (a short SMS/email draft for the customer)
- reasoning: string (max 60 words)

Return ONLY the JSON object — no prose, no markdown fences.`;

interface AnalyzeOutput {
  lead_quality?: string;
  stage?: string;
  score?: number;
  one_line_summary?: string;
  next_best_action?: string;
  followup_text?: string;
  reasoning?: string;
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });

  const { call_id } = (await req.json()) as { call_id: string };
  if (!call_id) return NextResponse.json({ error: "call_id required" }, { status: 400 });

  const sb = callscraperClient();
  const { data: call, error: callErr } = await sb.from("calls").select("*").eq("id", call_id).maybeSingle();
  if (callErr || !call) return NextResponse.json({ error: callErr?.message ?? "call not found" }, { status: 404 });

  const { data: summary } = await sb.from("call_summaries").select("*").eq("call_id", call_id).maybeSingle();

  const userPayload = {
    caller: call.resolved_name ?? call.caller_name ?? call.from_number,
    from_number: call.from_number,
    brand: call.brand,
    duration_seconds: call.duration_seconds ?? call.duration,
    occurred_at: call.started_at ?? call.date,
    outcome: call.call_outcome,
    summary: summary?.summary ?? summary?.call_summary,
    sentiment: summary?.sentiment,
    intent: summary?.intent,
    move_type: summary?.move_type,
    move_date: summary?.move_date,
    price_quoted: summary?.price_quoted,
    transcript_excerpt: (summary?.transcript ?? "").slice(0, 4000),
  };

  const client = new Anthropic({ apiKey });
  const t0 = Date.now();
  const res = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 600,
    system: SYSTEM,
    messages: [{ role: "user", content: JSON.stringify(userPayload) }],
  });
  const dur = Date.now() - t0;

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  let parsed: AnalyzeOutput | null = null;
  try {
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    parsed = jsonStart >= 0 ? JSON.parse(text.slice(jsonStart, jsonEnd + 1)) : null;
  } catch {
    parsed = null;
  }

  // Save the run
  const crm = crmClient();
  await crm.from("agent_runs").insert({
    org_id: DEFAULT_ORG_ID,
    agent_name: "Lead Triage",
    subject_kind: "call",
    subject_external_id: call_id,
    input: userPayload,
    output: parsed ?? { raw: text },
    status: parsed ? "ok" : "error",
    error: parsed ? null : "failed to parse JSON",
    model: "claude-opus-4-6",
    tokens_in: res.usage?.input_tokens,
    tokens_out: res.usage?.output_tokens,
    duration_ms: dur,
  });

  // Also append as activity on the call record
  if (parsed) {
    await crm.rpc("add_activity_by_external_id", {
      p_org_id: DEFAULT_ORG_ID,
      p_object_key: "call",
      p_external_id: call_id,
      p_kind: "ai_analysis",
      p_payload: parsed as unknown as Record<string, unknown>,
    });
  }

  return NextResponse.json({ result: parsed, raw: text, duration_ms: dur });
}
