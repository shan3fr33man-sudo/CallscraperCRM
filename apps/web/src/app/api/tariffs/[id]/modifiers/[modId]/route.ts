import { NextResponse } from "next/server";
import { crmClient } from "@/lib/crmdb";
import { requireOrgId } from "@/lib/auth";
import { parseBody } from "@/lib/validate";
import { updateModifierSchema } from "@callscrapercrm/pricing";

export const runtime = "nodejs";

async function verifyOwnership(
  sb: ReturnType<typeof crmClient>,
  tariffId: string,
  modId: string,
  orgId: string,
): Promise<boolean> {
  const { data } = await sb
    .from("tariff_modifiers")
    .select("id, tariffs!inner(org_id)")
    .eq("id", modId)
    .eq("tariff_id", tariffId)
    .maybeSingle();
  if (!data) return false;
  const joined = (data as unknown as { tariffs: { org_id: string } | { org_id: string }[] }).tariffs;
  const orgFromJoin = Array.isArray(joined) ? joined[0]?.org_id : joined?.org_id;
  return orgFromJoin === orgId;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; modId: string }> },
) {
  let orgId: string;
  try { orgId = await requireOrgId(); }
  catch (res) { if (res instanceof Response) return res; throw res; }
  const { id, modId } = await params;
  const body = await parseBody(req, updateModifierSchema);
  if (body instanceof Response) return body;

  const sb = crmClient();
  if (!(await verifyOwnership(sb, id, modId, orgId))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const { data, error } = await sb.from("tariff_modifiers").update(body).eq("id", modId).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ modifier: data });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; modId: string }> },
) {
  let orgId: string;
  try { orgId = await requireOrgId(); }
  catch (res) { if (res instanceof Response) return res; throw res; }
  const { id, modId } = await params;
  const sb = crmClient();
  if (!(await verifyOwnership(sb, id, modId, orgId))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const { error } = await sb.from("tariff_modifiers").delete().eq("id", modId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
