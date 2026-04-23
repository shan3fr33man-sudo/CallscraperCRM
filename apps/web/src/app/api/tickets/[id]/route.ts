import { NextResponse } from "next/server";
import { crmClient } from "@/lib/crmdb";
import { requireOrgId } from "@/lib/auth";
import { emitEvent } from "@/lib/river";
import { stripUndefined } from "@/lib/validate";

export const runtime = "nodejs";

const ALLOWED_FIELDS = [
  "ticket_name",
  "type",
  "status",
  "priority",
  "assigned_to",
  "follow_up_at",
  "last_activity_at",
] as const;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let orgId: string;
  try { orgId = await requireOrgId(); }
  catch (res) { if (res instanceof Response) return res; throw res; }
  const { id } = await params;
  const raw = (await req.json()) as Record<string, unknown>;
  const sb = crmClient();

  const patch: Record<string, unknown> = {};
  for (const k of ALLOWED_FIELDS) if (k in raw) patch[k] = raw[k];
  const cleaned = stripUndefined(patch);
  if (Object.keys(cleaned).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  // Cross-tenant safety: scope the update to this org
  const { data, error } = await sb
    .from("tickets")
    .update(cleaned)
    .eq("id", id)
    .eq("org_id", orgId)
    .select("*")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (cleaned.status === "completed") {
    await emitEvent(sb, {
      org_id: orgId,
      type: "ticket.closed",
      related_type: "ticket",
      related_id: id,
      payload: { ticket_id: id },
    });
  }
  if (cleaned.priority === "critical") {
    await emitEvent(sb, {
      org_id: orgId,
      type: "ticket.escalated",
      related_type: "ticket",
      related_id: id,
      payload: { ticket_id: id },
    });
  }
  return NextResponse.json({ ticket: data });
}
