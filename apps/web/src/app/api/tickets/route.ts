import { NextResponse } from "next/server";
import { crmClient } from "@/lib/crmdb";
import { getOrgId } from "@/lib/auth";
import { emitEvent } from "@/lib/river";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const customerId = url.searchParams.get("customer_id");
  const sb = crmClient();
  const orgId = await getOrgId();
  let q = sb.from("tickets").select("*").eq("org_id", orgId).order("opened_at", { ascending: false }).limit(500);
  if (status) q = q.eq("status", status);
  if (customerId) q = q.eq("customer_id", customerId);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tickets: data ?? [] });
}

export async function POST(req: Request) {
  const body = (await req.json()) as Record<string, unknown>;
  const sb = crmClient();
  const orgId = await getOrgId();
  const { data, error } = await sb.from("tickets").insert({ org_id: orgId, ...body }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await emitEvent(sb, { org_id: orgId, type: "ticket.opened", related_type: "ticket", related_id: data.id, payload: { ticket_id: data.id } });
  return NextResponse.json({ ticket: data });
}
