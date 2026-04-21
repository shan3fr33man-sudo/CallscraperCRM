import { NextResponse } from "next/server";
import { crmClient } from "@/lib/crmdb";
import { getOrgId } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = crmClient();
  const orgId = await getOrgId();
  const { data, error } = await sb
    .from("invoices")
    .select("*")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (error || !data) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Eager-load payments
  const { data: payments } = await sb
    .from("payments")
    .select("*")
    .eq("invoice_id", id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ invoice: data, payments: payments ?? [] });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as Record<string, unknown>;
  const sb = crmClient();
  const orgId = await getOrgId();

  const allowed: Record<string, unknown> = {};
  for (const k of [
    "status",
    "line_items_json",
    "subtotal",
    "discounts",
    "sales_tax",
    "amount_due",
    "due_date",
    "notes",
    "invoice_number",
  ]) {
    if (k in body) allowed[k] = body[k];
  }
  allowed.updated_at = new Date().toISOString();

  const { data, error } = await sb
    .from("invoices")
    .update(allowed)
    .eq("id", id)
    .eq("org_id", orgId)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ invoice: data });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = crmClient();
  const orgId = await getOrgId();

  // Only allow delete if status = draft
  const { data: inv } = await sb
    .from("invoices")
    .select("status")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!inv) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (inv.status !== "draft") {
    return NextResponse.json({ error: "Can only delete draft invoices" }, { status: 400 });
  }
  const { error } = await sb.from("invoices").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
