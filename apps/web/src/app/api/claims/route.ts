import { NextResponse } from "next/server";
import { crmClient } from "@/lib/crmdb";
import { getOrgId } from "@/lib/auth";
import { emitEvent } from "@/lib/river";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const customerId = url.searchParams.get("customer_id");
  const sb = crmClient();
  const orgId = await getOrgId();
  let q = sb.from("claims").select("*").eq("org_id", orgId).order("opened_at", { ascending: false }).limit(200);
  if (customerId) q = q.eq("customer_id", customerId);
  const { data, error } = await q;
  if (error) return NextResponse.json({ claims: [] });
  return NextResponse.json({ claims: data ?? [] });
}

export async function POST(req: Request) {
  const body = (await req.json()) as Record<string, unknown>;
  const sb = crmClient();
  const orgId = await getOrgId();
  const { data, error } = await sb.from("claims").insert({ org_id: orgId, ...body }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await emitEvent(sb, { org_id: orgId, type: "claim.opened", related_type: "claim", related_id: data.id, payload: { claim_id: data.id, customer_id: data.customer_id } });
  return NextResponse.json({ claim: data });
}
