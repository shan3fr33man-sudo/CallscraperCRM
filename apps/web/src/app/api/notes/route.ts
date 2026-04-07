import { NextResponse } from "next/server";
import { crmClient, DEFAULT_ORG_ID } from "@/lib/crmdb";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { call_id, text } = (await req.json()) as { call_id: string; text: string };
  if (!call_id || !text) return NextResponse.json({ error: "call_id + text required" }, { status: 400 });
  const crm = crmClient();
  const { data, error } = await crm.rpc("add_activity_by_external_id", {
    p_org_id: DEFAULT_ORG_ID,
    p_object_key: "call",
    p_external_id: call_id,
    p_kind: "note",
    p_payload: { text, created_at: new Date().toISOString() },
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const callId = url.searchParams.get("call_id");
  if (!callId) return NextResponse.json({ error: "call_id required" }, { status: 400 });
  const crm = crmClient();
  // Find the record for this external id, then list activities.
  const { data: obj } = await crm
    .from("objects")
    .select("id")
    .eq("org_id", DEFAULT_ORG_ID)
    .eq("key", "call")
    .single();
  if (!obj) return NextResponse.json({ activities: [] });
  const { data: rec } = await crm
    .from("records")
    .select("id")
    .eq("org_id", DEFAULT_ORG_ID)
    .eq("object_id", obj.id)
    .eq("data->>external_id", callId)
    .maybeSingle();
  if (!rec) return NextResponse.json({ activities: [] });
  const { data: acts } = await crm
    .from("activities")
    .select("*")
    .eq("record_id", rec.id)
    .order("created_at", { ascending: false });
  return NextResponse.json({ activities: acts ?? [] });
}
