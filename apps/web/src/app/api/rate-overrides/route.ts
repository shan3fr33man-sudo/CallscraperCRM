import { NextResponse } from "next/server";
import { crmClient } from "@/lib/crmdb";
import { getOrgId } from "@/lib/auth";

export const runtime = "nodejs";

// Rate overrides are stored as tariff_modifiers with kind in (holiday|peak_season|weekend|other)
// scoped to a workspace-level "default" tariff. We don't require a tariff_id to keep this
// usable before the tariff editor ships in a later phase.

export async function GET() {
  const sb = crmClient();
  const { data, error } = await sb
    .from("tariff_modifiers")
    .select("id,kind,label,formula_json,created_at")
    .in("kind", ["holiday", "peak_season", "weekend", "other"])
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ overrides: [] });
  return NextResponse.json({ overrides: data ?? [] });
}

export async function POST(req: Request) {
  const body = (await req.json()) as { kind: string; label?: string; formula_json?: Record<string, unknown> };
  const sb = crmClient();
  const orgId = await getOrgId();

  // Find or create the workspace default tariff so the FK is satisfied.
  let tariffId: string | null = null;
  const { data: existing } = await sb.from("tariffs").select("id").eq("org_id", orgId).eq("is_default", true).maybeSingle();
  if (existing) tariffId = existing.id;
  else {
    const { data: created, error: tErr } = await sb.from("tariffs").insert({ org_id: orgId, name: "Default Tariff", is_default: true }).select("id").single();
    if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });
    tariffId = created!.id;
  }

  const { data, error } = await sb
    .from("tariff_modifiers")
    .insert({ tariff_id: tariffId, kind: body.kind, label: body.label ?? null, formula_json: body.formula_json ?? {} })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ override: data });
}
