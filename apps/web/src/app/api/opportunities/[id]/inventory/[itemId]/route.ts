import { NextResponse } from "next/server";
import { crmClient } from "@/lib/crmdb";
import { getOrgId } from "@/lib/auth";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const { id, itemId } = await params;
  const body = (await req.json()) as Record<string, unknown>;
  const sb = crmClient();
  const orgId = await getOrgId();

  const allowed: Record<string, unknown> = {};
  for (const k of ["room_name", "item_name", "quantity", "weight_lbs", "cubic_feet", "is_heavy", "notes"]) {
    if (k in body) allowed[k] = body[k];
  }

  const { data, error } = await sb
    .from("inventory_items")
    .update(allowed)
    .eq("id", itemId)
    .eq("opportunity_id", id)
    .eq("org_id", orgId)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const { id, itemId } = await params;
  const sb = crmClient();
  const orgId = await getOrgId();
  const { error } = await sb
    .from("inventory_items")
    .delete()
    .eq("id", itemId)
    .eq("opportunity_id", id)
    .eq("org_id", orgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
