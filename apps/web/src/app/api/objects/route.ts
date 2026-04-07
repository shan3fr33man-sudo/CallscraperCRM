import { NextResponse } from "next/server";
import { crmClient, DEFAULT_ORG_ID } from "@/lib/crmdb";

export const runtime = "nodejs";

export async function GET() {
  const sb = crmClient();
  const { data: objects, error } = await sb
    .from("objects")
    .select("*, fields(*)")
    .eq("org_id", DEFAULT_ORG_ID)
    .order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ objects: objects ?? [] });
}

export async function POST(req: Request) {
  const { key, label } = (await req.json()) as { key: string; label: string };
  if (!key || !label) return NextResponse.json({ error: "key + label required" }, { status: 400 });
  const sb = crmClient();
  const { data, error } = await sb
    .from("objects")
    .insert({ org_id: DEFAULT_ORG_ID, key, label, is_system: false })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
