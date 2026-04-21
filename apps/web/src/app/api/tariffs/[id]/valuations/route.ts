import { NextResponse } from "next/server";
import { crmClient } from "@/lib/crmdb";
import { getOrgId } from "@/lib/auth";
import { parseBody } from "@/lib/validate";
import { createValuationSchema } from "@callscrapercrm/pricing";

export const runtime = "nodejs";

async function verifyTariff(
  sb: ReturnType<typeof crmClient>,
  tariffId: string,
  orgId: string,
): Promise<boolean> {
  const { data } = await sb.from("tariffs").select("id").eq("id", tariffId).eq("org_id", orgId).maybeSingle();
  return Boolean(data);
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = crmClient();
  const orgId = await getOrgId();
  if (!(await verifyTariff(sb, id, orgId))) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { data, error } = await sb.from("tariff_valuations").select("*").eq("tariff_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ valuations: data ?? [] });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await parseBody(req, createValuationSchema);
  if (body instanceof Response) return body;

  const sb = crmClient();
  const orgId = await getOrgId();
  if (!(await verifyTariff(sb, id, orgId))) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { data, error } = await sb
    .from("tariff_valuations")
    .insert({ tariff_id: id, ...body })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ valuation: data });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const valId = searchParams.get("valuation_id");
  if (!valId) return NextResponse.json({ error: "valuation_id required" }, { status: 400 });
  const sb = crmClient();
  const orgId = await getOrgId();
  if (!(await verifyTariff(sb, id, orgId))) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { error } = await sb.from("tariff_valuations").delete().eq("id", valId).eq("tariff_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
