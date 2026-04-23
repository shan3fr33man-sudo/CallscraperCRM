import { NextResponse } from "next/server";
import { crmClient } from "@/lib/crmdb";
import { requireOrgId } from "@/lib/auth";
import { stripUndefined } from "@/lib/validate";

export const runtime = "nodejs";

const ALLOWED_FIELDS = [
  "customer_name",
  "customer_phone",
  "customer_email",
  "brand",
  "source",
  "status",
  "address_json",
  "tags",
  "notes",
  "balance",
  "latest_assigned_to",
  "stripe_customer_id",
] as const;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  let orgId: string;
  try { orgId = await requireOrgId(); }
  catch (res) { if (res instanceof Response) return res; throw res; }
  const { id } = await params;
  const sb = crmClient();
  const { data, error } = await sb
    .from("customers")
    .select("*")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (error || !data) return NextResponse.json({ error: error?.message ?? "not found" }, { status: 404 });
  return NextResponse.json({ customer: data });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let orgId: string;
  try { orgId = await requireOrgId(); }
  catch (res) { if (res instanceof Response) return res; throw res; }
  const { id } = await params;
  const raw = (await req.json()) as Record<string, unknown>;
  const sb = crmClient();

  // Whitelist fields — never allow body to set org_id, id, etc.
  const patch: Record<string, unknown> = {};
  for (const k of ALLOWED_FIELDS) if (k in raw) patch[k] = raw[k];
  const cleaned = stripUndefined(patch);
  if (Object.keys(cleaned).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  // Cross-tenant safety: scope the update to this org
  const { data, error } = await sb
    .from("customers")
    .update(cleaned)
    .eq("id", id)
    .eq("org_id", orgId)
    .select("*")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ customer: data });
}
