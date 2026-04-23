import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { crmClient } from "@/lib/crmdb";
import { requireOrgId } from "@/lib/auth";
import { emitEvent } from "@/lib/river";
import { logAiUsage } from "@/lib/ai-usage";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "claude-opus-4-6";

type LineItem = { name: string; rate: number; qty: number; subtotal: number };
type DraftResult = {
  line_items: LineItem[];
  discount: number;
  sales_tax_pct: number;
  notes: string;
  confidence: "high" | "medium" | "low";
};

const PROMPT_HEAD = `You are a moving company estimator for a Seattle/Everett WA company. Based on this job info, create a detailed line-item estimate.

Return ONLY valid JSON (no prose, no markdown fences) in this exact shape:
{
  "line_items": [ { "name": string, "rate": number, "qty": number, "subtotal": number } ],
  "discount": number,
  "sales_tax_pct": number,
  "notes": string,
  "confidence": "high" | "medium" | "low"
}

Typical rates:
- Labor: $150-200/hr per mover (2-4 movers typical)
- Truck: $100-150/hr
- Packing materials: flat $50-200
- Long carry / stairs: $75-150 flat
Include 3-6 line items. Be realistic.`;

function stripFences(s: string): string {
  return s.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();
}

export async function POST(req: Request) {
  let orgId: string;
  try { orgId = await requireOrgId(); }
  catch (res) { if (res instanceof Response) return res; throw res; }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Add your Anthropic API key in Settings → Integrations → API Keys" },
      { status: 402 },
    );
  }
  const { opportunity_id } = (await req.json()) as { opportunity_id?: string };
  if (!opportunity_id) return NextResponse.json({ error: "opportunity_id required" }, { status: 400 });

  const sb = crmClient();
  const opp = await sb
    .from("opportunities")
    .select("id, customer_id, service_type, move_type, move_size, service_date, origin_json, destination_json, amount")
    .eq("id", opportunity_id)
    .single();
  if (opp.error || !opp.data) return NextResponse.json({ error: opp.error?.message ?? "opportunity not found" }, { status: 404 });

  let customerName = "Customer";
  if (opp.data.customer_id) {
    const c = await sb.from("customers").select("customer_name").eq("id", opp.data.customer_id).single();
    if (c.data?.customer_name) customerName = c.data.customer_name;
  }

  // Most recent call activity with summary data
  let summary: Record<string, unknown> = {};
  if (opp.data.customer_id) {
    const acts = await sb
      .from("activities")
      .select("payload, created_at")
      .eq("org_id", orgId)
      .eq("record_id", opp.data.customer_id)
      .eq("kind", "call")
      .order("created_at", { ascending: false })
      .limit(5);
    const withSummary = (acts.data ?? []).find((a) => {
      const p = (a.payload as Record<string, unknown>) ?? {};
      return p.summary != null || p.key_details != null || p.price_quoted != null;
    });
    if (withSummary) summary = (withSummary.payload as Record<string, unknown>) ?? {};
  }

  const context = {
    customer_name: customerName,
    move_type: summary.move_type ?? opp.data.move_type ?? opp.data.service_type ?? null,
    move_size: opp.data.move_size ?? null,
    origin: opp.data.origin_json ?? null,
    destination: opp.data.destination_json ?? null,
    key_details: summary.key_details ?? null,
    price_quoted_in_call: summary.price_quoted ?? null,
    service_date: opp.data.service_date ?? null,
  };

  const client = new Anthropic({ apiKey });
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    messages: [
      { role: "user", content: `${PROMPT_HEAD}\n\nJob info:\n${JSON.stringify(context, null, 2)}` },
    ],
  });
  await logAiUsage("estimate_draft", res.usage?.input_tokens ?? 0, res.usage?.output_tokens ?? 0);

  const raw = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  let draft: DraftResult;
  try {
    draft = JSON.parse(stripFences(raw));
  } catch {
    return NextResponse.json({ error: "AI returned invalid format", raw }, { status: 422 });
  }

  const lineItems: LineItem[] = Array.isArray(draft.line_items) ? draft.line_items : [];
  const subtotal = lineItems.reduce((s, li) => s + (Number(li.subtotal) || 0), 0);
  const discount = Number(draft.discount) || 0;
  const taxPct = Number(draft.sales_tax_pct) || 0;
  const salesTax = Math.round((subtotal - discount) * (taxPct / 100) * 100) / 100;
  const total = Math.round((subtotal - discount + salesTax) * 100) / 100;

  const ins = await sb
    .from("estimates")
    .insert({
      org_id: orgId,
      opportunity_id,
      charges_json: lineItems,
      subtotal,
      discounts: discount,
      sales_tax: salesTax,
      amount: total,
      tariff_snapshot: { drafted_by: "ai", confidence: draft.confidence ?? "medium", notes: draft.notes ?? "" },
    })
    .select("id")
    .single();
  if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 500 });

  await emitEvent(sb, {
    org_id: orgId,
    type: "estimate.created",
    related_type: "estimate",
    related_id: ins.data.id,
    payload: { drafted_by: "ai", opportunity_id, amount: total, confidence: draft.confidence ?? "medium" },
  });

  return NextResponse.json({
    estimate_id: ins.data.id,
    estimated_total: total,
    line_items: lineItems,
    confidence: draft.confidence ?? "medium",
  });
}
