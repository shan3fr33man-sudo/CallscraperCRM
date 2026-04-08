import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { callscraperClient } from "@/lib/callscraper";
import { crmClient, DEFAULT_ORG_ID } from "@/lib/crmdb";
import { emitEvent } from "@/lib/river";
import { logAiUsage } from "@/lib/ai-usage";

export const runtime = "nodejs";

const MODEL = "claude-opus-4-6";

type Ctx = {
  page?: string;
  record_type?: string;
  record_id?: string;
  record_name?: string;
};

function systemPrompt(ctx?: Ctx) {
  if (ctx?.page) {
    const where = ctx.record_type && ctx.record_name
      ? ` They are viewing ${ctx.record_type} "${ctx.record_name}"${ctx.record_id ? ` (id: ${ctx.record_id})` : ""}.`
      : "";
    return `You are a CRM assistant for a moving company (CallscraperCRM). The user is currently on page: ${ctx.page}.${where} You have tools to search customers, create opportunities, create tasks, view timelines, list overdue tasks, send templates, and summarize the pipeline. Use them when relevant. Be concise. Context: APM, AFM, crewready, apex brands.`;
  }
  return "You are a CRM assistant for a moving company called CallscraperCRM. You help with leads, jobs, estimates, and customer service. Be concise and practical.";
}

const tools: Anthropic.Tool[] = [
  // Existing upstream tools (preserved)
  {
    name: "search_calls",
    description: "Search recent calls in the upstream callscraper Supabase. Returns up to 20 rows.",
    input_schema: { type: "object", properties: { days: { type: "number" }, brand: { type: "string" }, limit: { type: "number" } } },
  },
  {
    name: "search_transcripts",
    description: "Full-text search across call transcripts and AI summaries.",
    input_schema: { type: "object", properties: { query: { type: "string" }, limit: { type: "number" } }, required: ["query"] },
  },
  {
    name: "search_leads",
    description: "Search upstream leads. Returns up to 20 rows.",
    input_schema: { type: "object", properties: { days: { type: "number" }, brand: { type: "string" }, limit: { type: "number" } } },
  },
  // New river tools
  {
    name: "search_customers",
    description: "Search CRM customers by name or phone number.",
    input_schema: { type: "object", properties: { query: { type: "string", description: "min 2 chars" } }, required: ["query"] },
  },
  {
    name: "get_customer_timeline",
    description: "Get full activity timeline for a customer (last 20 activities).",
    input_schema: { type: "object", properties: { customer_id: { type: "string" } }, required: ["customer_id"] },
  },
  {
    name: "create_opportunity",
    description: "Create a new sales opportunity for a customer.",
    input_schema: {
      type: "object",
      properties: {
        customer_id: { type: "string" },
        customer_name: { type: "string" },
        service_type: { type: "string" },
        move_size: { type: "string" },
        service_date: { type: "string" },
        amount: { type: "number" },
        source: { type: "string" },
        notes: { type: "string" },
      },
      required: ["customer_id"],
    },
  },
  {
    name: "create_task",
    description: "Create a follow-up task or reminder.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        due_at: { type: "string", description: "ISO datetime" },
        assigned_to: { type: "string" },
        related_type: { type: "string" },
        related_id: { type: "string" },
        priority: { type: "string", description: "low|medium|high" },
        type: { type: "string" },
      },
      required: ["title", "due_at"],
    },
  },
  {
    name: "list_overdue_tasks",
    description: "List tasks that are past their due date and not completed.",
    input_schema: { type: "object", properties: { limit: { type: "number" } } },
  },
  {
    name: "send_template",
    description: "Queue an SMS or email from a template to a customer.",
    input_schema: {
      type: "object",
      properties: {
        customer_id: { type: "string" },
        template_key: { type: "string" },
        channel: { type: "string", description: "sms or email" },
      },
      required: ["customer_id", "template_key", "channel"],
    },
  },
  {
    name: "get_pipeline_summary",
    description: "Get a summary of the current sales pipeline grouped by status.",
    input_schema: { type: "object", properties: { days: { type: "number", description: "default 30" } } },
  },
];

function priorityToInt(p?: string): number {
  if (!p) return 2;
  const s = p.toLowerCase();
  if (s === "high") return 3;
  if (s === "low") return 1;
  return 2;
}

async function runTool(name: string, input: Record<string, unknown>): Promise<unknown> {
  // Upstream tools
  if (name === "search_calls" || name === "search_transcripts" || name === "search_leads") {
    const sb = callscraperClient();
    const days = (input.days as number) ?? 7;
    const limit = Math.min((input.limit as number) ?? 20, 50);
    const since = new Date(Date.now() - days * 86400000).toISOString();
    if (name === "search_calls") {
      let q = sb.from("calls").select("id,date,from_number,brand,duration_seconds,call_outcome,resolved_name").gte("date", since).order("date", { ascending: false }).limit(limit);
      if (input.brand) q = q.eq("brand", input.brand as string);
      const { data, error } = await q;
      return error ? { error: error.message } : { rows: data };
    }
    if (name === "search_transcripts") {
      const query = (input.query as string) ?? "";
      const ilike = `%${query}%`;
      const { data, error } = await sb.from("call_summaries").select("call_id,summary,transcript").or(`summary.ilike.${ilike},transcript.ilike.${ilike}`).limit(limit);
      return error ? { error: error.message } : { rows: data };
    }
    let q = sb.from("leads").select("id,created_at,customer_name,customer_phone,brand").gte("created_at", since).order("created_at", { ascending: false }).limit(limit);
    if (input.brand) q = q.eq("brand", input.brand as string);
    const { data, error } = await q;
    return error ? { error: error.message } : { rows: data };
  }

  // River tools — operate on CRM
  const sb = crmClient();
  if (name === "search_customers") {
    const query = String(input.query ?? "").trim();
    if (query.length < 2) return { error: "query must be >= 2 chars" };
    const ilike = `%${query}%`;
    const { data, error } = await sb
      .from("customers")
      .select("id, customer_name, customer_phone, status, source, brand, created_at")
      .eq("org_id", DEFAULT_ORG_ID)
      .or(`customer_name.ilike.${ilike},customer_phone.ilike.${ilike}`)
      .limit(10);
    return error ? { error: error.message } : { rows: data };
  }
  if (name === "get_customer_timeline") {
    const customer_id = String(input.customer_id ?? "");
    if (!customer_id) return { error: "customer_id required" };
    const { data, error } = await sb
      .from("activities")
      .select("kind, payload, created_at")
      .eq("org_id", DEFAULT_ORG_ID)
      .eq("record_id", customer_id)
      .order("created_at", { ascending: false })
      .limit(20);
    return error ? { error: error.message } : { rows: data };
  }
  if (name === "create_opportunity") {
    const customer_id = String(input.customer_id ?? "");
    if (!customer_id) return { error: "customer_id required" };
    const row = {
      org_id: DEFAULT_ORG_ID,
      customer_id,
      status: "new",
      service_type: (input.service_type as string) ?? null,
      move_size: (input.move_size as string) ?? null,
      service_date: (input.service_date as string) ?? null,
      amount: (input.amount as number) ?? null,
      source: (input.source as string) ?? "ai",
    };
    const ins = await sb.from("opportunities").insert(row).select("id, quote_number").single();
    if (ins.error) return { error: ins.error.message };
    await emitEvent(sb, {
      org_id: DEFAULT_ORG_ID,
      type: "opportunity.created",
      related_type: "opportunity",
      related_id: ins.data.id,
      payload: { source: "ai_chat", customer_id, notes: input.notes ?? null },
    });
    return { id: ins.data.id, quote_number: ins.data.quote_number, customer_name: input.customer_name ?? null };
  }
  if (name === "create_task") {
    const row = {
      org_id: DEFAULT_ORG_ID,
      title: String(input.title ?? "(untitled)"),
      body: null,
      due_at: String(input.due_at ?? new Date().toISOString()),
      status: "not_started",
      assigned_to: (input.assigned_to as string) ?? null,
      type: (input.type as string) ?? "follow_up",
      priority: priorityToInt(input.priority as string | undefined),
      related_type: (input.related_type as string) ?? null,
      related_id: (input.related_id as string) ?? null,
    };
    const ins = await sb.from("tasks").insert(row).select("id, title, due_at").single();
    if (ins.error) return { error: ins.error.message };
    await emitEvent(sb, {
      org_id: DEFAULT_ORG_ID,
      type: "task.created",
      related_type: "task",
      related_id: ins.data.id,
      payload: { source: "ai_chat", title: ins.data.title },
    });
    return { id: ins.data.id, title: ins.data.title, due_at: ins.data.due_at };
  }
  if (name === "list_overdue_tasks") {
    const limit = Math.min((input.limit as number) ?? 10, 50);
    const { data, error } = await sb
      .from("tasks")
      .select("id, title, due_at, assigned_to, priority, related_type")
      .eq("org_id", DEFAULT_ORG_ID)
      .lt("due_at", new Date().toISOString())
      .neq("status", "completed")
      .order("due_at", { ascending: true })
      .limit(limit);
    return error ? { error: error.message } : { rows: data };
  }
  if (name === "send_template") {
    const customer_id = String(input.customer_id ?? "");
    const channel = String(input.channel ?? "");
    const template_key = String(input.template_key ?? "");
    if (!customer_id || !channel || !template_key) return { error: "customer_id, channel, template_key required" };
    const cust = await sb.from("customers").select("id, customer_name, customer_phone, customer_email").eq("id", customer_id).single();
    if (cust.error || !cust.data) return { error: cust.error?.message ?? "customer not found" };
    if (channel === "sms") {
      const ins = await sb.from("sms_logs").insert({
        org_id: DEFAULT_ORG_ID,
        customer_id,
        to_number: cust.data.customer_phone,
        message: `[${template_key}]`,
        status: "queued",
        template_key,
      }).select("id").single();
      if (ins.error) return { error: ins.error.message };
      await emitEvent(sb, { org_id: DEFAULT_ORG_ID, type: "message.queued", related_type: "sms_log", related_id: ins.data.id, payload: { channel: "sms", template_key, customer_id } });
    } else if (channel === "email") {
      const ins = await sb.from("email_logs").insert({
        org_id: DEFAULT_ORG_ID,
        customer_id,
        to_email: cust.data.customer_email,
        subject: `[${template_key}]`,
        body: `[${template_key}]`,
        status: "queued",
        template_key,
      }).select("id").single();
      if (ins.error) return { error: ins.error.message };
      await emitEvent(sb, { org_id: DEFAULT_ORG_ID, type: "message.queued", related_type: "email_log", related_id: ins.data.id, payload: { channel: "email", template_key, customer_id } });
    } else {
      return { error: "channel must be sms or email" };
    }
    return { queued: true, channel, customer_name: cust.data.customer_name, template_key };
  }
  if (name === "get_pipeline_summary") {
    const days = (input.days as number) ?? 30;
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const { data, error } = await sb
      .from("opportunities")
      .select("status, amount")
      .eq("org_id", DEFAULT_ORG_ID)
      .gte("created_at", since);
    if (error) return { error: error.message };
    const byStatus = new Map<string, { count: number; total_amount: number }>();
    (data ?? []).forEach((o) => {
      const key = String(o.status ?? "unknown");
      const cur = byStatus.get(key) ?? { count: 0, total_amount: 0 };
      cur.count += 1;
      cur.total_amount += Number(o.amount ?? 0);
      byStatus.set(key, cur);
    });
    const rows = Array.from(byStatus.entries())
      .map(([status, v]) => ({ status, count: v.count, total_amount: v.total_amount }))
      .sort((a, b) => b.count - a.count);
    return { rows };
  }

  return { error: `unknown tool ${name}` };
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Add your Anthropic API key in Settings → Integrations → API Keys" },
      { status: 402 },
    );
  }

  const body = (await req.json()) as { messages: { role: "user" | "assistant"; content: string }[]; context?: Ctx };
  const { messages, context } = body;
  const client = new Anthropic({ apiKey });

  const convo: Anthropic.MessageParam[] = messages.map((m) => ({ role: m.role, content: m.content }));
  let totalIn = 0;
  let totalOut = 0;

  for (let i = 0; i < 4; i++) {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt(context),
      tools,
      messages: convo,
    });
    totalIn += res.usage?.input_tokens ?? 0;
    totalOut += res.usage?.output_tokens ?? 0;

    const toolUses = res.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (toolUses.length === 0) {
      const text = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n");
      await logAiUsage("chat", totalIn, totalOut);
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
  await logAiUsage("chat", totalIn, totalOut);
  return NextResponse.json({ reply: "(tool loop limit reached)" });
}
