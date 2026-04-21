import { NextResponse } from "next/server";
import { crmClient } from "@/lib/crmdb";
import { getOrgId } from "@/lib/auth";
import { parseBody } from "@/lib/validate";
import { createAssignmentSchema } from "@callscrapercrm/pricing";

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
  const { data, error } = await sb
    .from("tariff_assignments")
    .select("*")
    .eq("tariff_id", id)
    .order("priority", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ assignments: data ?? [] });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await parseBody(req, createAssignmentSchema);
  if (body instanceof Response) return body;

  const sb = crmClient();
  const orgId = await getOrgId();
  if (!(await verifyTariff(sb, id, orgId))) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Branch ownership check if specified
  if (body.branch_id) {
    const { data: branch } = await sb
      .from("branches")
      .select("id")
      .eq("id", body.branch_id)
      .eq("org_id", orgId)
      .maybeSingle();
    if (!branch) {
      return NextResponse.json({ error: "branch_id does not exist in this org" }, { status: 404 });
    }
  }

  const { data, error } = await sb
    .from("tariff_assignments")
    .insert({ tariff_id: id, ...body })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ assignment: data });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const assignmentId = searchParams.get("assignment_id");
  if (!assignmentId) return NextResponse.json({ error: "assignment_id required" }, { status: 400 });
  const sb = crmClient();
  const orgId = await getOrgId();
  if (!(await verifyTariff(sb, id, orgId))) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { error } = await sb
    .from("tariff_assignments")
    .delete()
    .eq("id", assignmentId)
    .eq("tariff_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
