import { NextResponse } from "next/server";
import { crmClient } from "@/lib/crmdb";
import { getOrgId } from "@/lib/auth";

export const runtime = "nodejs";

/** GET /api/settings/[category] — list all settings in a category. */
export async function GET(_req: Request, { params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const sb = crmClient();
  const orgId = await getOrgId();
  const { data, error } = await sb
    .from("settings")
    .select("*")
    .eq("org_id", orgId)
    .eq("category", category)
    .order("key");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ settings: data ?? [] });
}

/** POST /api/settings/[category] — upsert a setting. Body: { key, value }. */
export async function POST(req: Request, { params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const body = (await req.json()) as { key: string; value: unknown };
  if (!body.key) return NextResponse.json({ error: "key required" }, { status: 400 });
  const sb = crmClient();
  const orgId = await getOrgId();
  const { data, error } = await sb
    .from("settings")
    .upsert(
      { org_id: orgId, category, key: body.key, value: body.value ?? {}, updated_at: new Date().toISOString() },
      { onConflict: "org_id,category,key" },
    )
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ setting: data });
}
