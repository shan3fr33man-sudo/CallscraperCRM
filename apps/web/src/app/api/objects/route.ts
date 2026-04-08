import { NextResponse } from "next/server";
import { crmClient } from "@/lib/crmdb";
import { getOrgId } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const sb = crmClient();
  const orgId = await getOrgId();
  const { data: objects, error } = await sb
    .from("objects")
    .select("*, fields(*)")
    .eq("org_id", orgId)
    .order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ objects: objects ?? [] });
}

export async function POST(req: Request) {
  const { key, label } = (await req.json()) as { key: string; label: string };
  if (!key || !label) return NextResponse.json({ error: "key + label required" }, { status: 400 });
  const sb = crmClient();
  const orgId = await getOrgId();
  const { data, error } = await sb
    .from("objects")
    .insert({ org_id: orgId, key, label, is_system: false })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
