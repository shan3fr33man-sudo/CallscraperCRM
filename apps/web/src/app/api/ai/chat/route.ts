import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { callscraperClient } from "@/lib/callscraper";

export const runtime = "nodejs";

const SYSTEM = `You are the CallscraperCRM assistant for a moving company. You can search calls and leads via the supplied tools. Be concise and quote concrete numbers.`;

const tools: Anthropic.Tool[] = [
  {
    name: "search_calls",
    description: "Search recent calls in the upstream callscraper Supabase. Returns up to 20 rows.",
    input_schema: {
      type: "object",
      properties: {
        days: { type: "number", description: "Look back this many days (default 7)" },
        brand: { type: "string", description: "Optional brand filter (APM, AFM, crewready, apex)" },
        limit: { type: "number" },
      },
    },
  },
  {
    name: "search_leads",
    description: "Search recent leads. Returns up to 20 rows.",
    input_schema: {
      type: "object",
      properties: {
        days: { type: "number" },
        brand: { type: "string" },
        limit: { type: "number" },
      },
    },
  },
];

async function runTool(name: string, input: Record<string, unknown>) {
  const sb = callscraperClient();
  const days = (input.days as number) ?? 7;
  const limit = Math.min((input.limit as number) ?? 20, 50);
  const since = new Date(Date.now() - days * 86400000).toISOString();

  if (name === "search_calls") {
    let q = sb.from("calls").select("id,date,from_number,brand,duration_seconds,call_outcome,resolved_name").gte("date", since).order("date", { ascending: false }).limit(limit);
    if (input.brand) q = q.eq("brand", input.brand as string);
    const { data, error } = await q;
    if (error) return { error: error.message };
    return { rows: data };
  }
  if (name === "search_leads") {
    let q = sb.from("leads").select("id,created_at,customer_name,customer_phone,brand").gte("created_at", since).order("created_at", { ascending: false }).limit(limit);
    if (input.brand) q = q.eq("brand", input.brand as string);
    const { data, error } = await q;
    if (error) return { error: error.message };
    return { rows: data };
  }
  return { error: `unknown tool ${name}` };
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });

  const { messages } = (await req.json()) as { messages: { role: "user" | "assistant"; content: string }[] };
  const client = new Anthropic({ apiKey });

  const convo: Anthropic.MessageParam[] = messages.map((m) => ({ role: m.role, content: m.content }));

  // Up to 4 tool-use rounds.
  for (let i = 0; i < 4; i++) {
    const res = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 1024,
      system: SYSTEM,
      tools,
      messages: convo,
    });

    const toolUses = res.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (toolUses.length === 0) {
      const text = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n");
      return NextResponse.json({ reply: text });
    }

    convo.push({ role: "assistant", content: res.content });
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const t of toolUses) {
      const out = await runTool(t.name, (t.input as Record<string, unknown>) ?? {});
      results.push({ type: "tool_result", tool_use_id: t.id, content: JSON.stringify(out) });
    }
    convo.push({ role: "user", content: results });
  }
  return NextResponse.json({ reply: "(tool loop limit reached)" });
}
