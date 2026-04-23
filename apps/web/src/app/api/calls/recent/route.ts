import { NextResponse } from "next/server";
import { callscraperClient } from "@/lib/callscraper";
import { crmClient } from "@/lib/crmdb";
import { requireOrgId, getOrgId } from "@/lib/auth";

export const runtime = "nodejs";

type CallRow = {
  id: string;
  caller_name: string;
  from_number: string | null;
  duration_seconds: number | null;
  call_outcome: string | null;
  brand: string | null;
  direction: string | null;
  started_at: string | null;
  lead_quality: string | null;
  intent: string | null;
  move_type: string | null;
  move_date: string | null;
  price_quoted: string | number | null;
  has_summary: boolean;
  customer_id?: string | null;
};

async function fromCrm(): Promise<CallRow[]> {
  const sb = crmClient();
  const orgId = await getOrgId();
  const { data, error } = await sb
    .from("activities")
    .select("id, record_id, payload, created_at")
    .eq("org_id", orgId)
    .eq("kind", "call")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error || !data) return [];
  return data.map((a) => {
    const p = (a.payload as Record<string, unknown>) ?? {};
    return {
      id: String(p.external_id ?? a.id),
      caller_name: (p.resolved_name as string) ?? (p.caller_name as string) ?? (p.from_number as string) ?? "Unknown",
      from_number: (p.from_number as string) ?? null,
      duration_seconds: (p.duration_seconds as number) ?? null,
      call_outcome: (p.call_outcome as string) ?? null,
      brand: (p.brand as string) ?? null,
      direction: (p.direction as string) ?? null,
      started_at: (p.started_at as string) ?? a.created_at,
      lead_quality: (p.lead_quality as string) ?? null,
      intent: (p.intent as string) ?? null,
      move_type: (p.move_type as string) ?? null,
      move_date: (p.move_date as string) ?? null,
      price_quoted: (p.price_quoted as string | number) ?? null,
      has_summary: p.summary != null || p.transcript != null,
      customer_id: a.record_id as string | null,
    };
  });
}

async function fromUpstream(): Promise<CallRow[]> {
  const sb = callscraperClient();
  const { data: calls, error } = await sb
    .from("calls")
    .select("id,from_number,to_number,duration_seconds,call_outcome,brand,started_at,resolved_name,caller_name,direction")
    .order("started_at", { ascending: false })
    .limit(20);
  if (error || !calls) return [];
  const ids = calls.map((c) => c.id);
  const { data: summaries } = ids.length
    ? await sb.from("call_summaries").select("call_id,lead_quality,intent,move_type,move_date,price_quoted").in("call_id", ids)
    : { data: [] as Array<Record<string, unknown>> };
  const byCall = new Map((summaries ?? []).map((s) => [s.call_id as string, s]));
  return calls.map((c) => {
    const s = byCall.get(c.id) as Record<string, unknown> | undefined;
    return {
      id: c.id,
      caller_name: c.resolved_name ?? c.caller_name ?? c.from_number ?? "Unknown",
      from_number: c.from_number,
      duration_seconds: c.duration_seconds,
      call_outcome: c.call_outcome,
      brand: c.brand,
      direction: c.direction,
      started_at: c.started_at,
      lead_quality: (s?.lead_quality as string) ?? null,
      intent: (s?.intent as string) ?? null,
      move_type: (s?.move_type as string) ?? null,
      move_date: (s?.move_date as string) ?? null,
      price_quoted: (s?.price_quoted as string | number) ?? null,
      has_summary: !!s,
    };
  });
}

export async function GET() {
  try { await requireOrgId(); }
  catch (res) { if (res instanceof Response) return res; throw res; }
  try {
    const crm = await fromCrm();
    if (crm.length > 0) return NextResponse.json({ calls: crm, source: "crm" });
    const up = await fromUpstream();
    return NextResponse.json({ calls: up, source: "upstream" });
  } catch (e) {
    return NextResponse.json({ calls: [], error: (e as Error).message });
  }
}
