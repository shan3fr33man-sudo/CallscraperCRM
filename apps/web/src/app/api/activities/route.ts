import { NextResponse } from "next/server";
import { crmClient, DEFAULT_ORG_ID } from "@/lib/crmdb";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const relatedType = url.searchParams.get("related_type");
  const relatedId = url.searchParams.get("related_id");
  const customerId = url.searchParams.get("customer_id");
  const sb = crmClient();
  let q = sb.from("activities").select("*").eq("org_id", DEFAULT_ORG_ID).order("created_at", { ascending: false }).limit(200);
  if (relatedType) q = q.eq("related_type", relatedType);
  if (relatedId) q = q.eq("related_id", relatedId);
  if (customerId) q = q.eq("customer_id", customerId);
  const { data, error } = await q;
  if (error) return NextResponse.json({ activities: [] });
  return NextResponse.json({ activities: data ?? [] });
}

export async function POST(req: Request) {
  const body = (await req.json()) as Record<string, unknown>;
  const sb = crmClient();
  const { data, error } = await sb.from("activities").insert({ org_id: DEFAULT_ORG_ID, ...body }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ activity: data });
}
