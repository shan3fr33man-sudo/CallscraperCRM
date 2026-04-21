import { NextResponse } from "next/server";
import { crmClient } from "@/lib/crmdb";
import { getOrgId } from "@/lib/auth";
import { emitEvent } from "@/lib/river";
import { stripUndefined } from "@/lib/validate";

export const runtime = "nodejs";

const ALLOWED_FIELDS = ["title", "body", "due_at", "status", "type", "priority", "assigned_to", "completed_at"] as const;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const raw = (await req.json()) as Record<string, unknown>;
  const sb = crmClient();
  const orgId = await getOrgId();

  // Whitelist fields — never let the body set org_id, related_type, etc.
  const patch: Record<string, unknown> = {};
  for (const k of ALLOWED_FIELDS) if (k in raw) patch[k] = raw[k];
  const cleaned = stripUndefined(patch);
  if (Object.keys(cleaned).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  // Cross-tenant safety: scope the update to this org
  const { data, error } = await sb
    .from("tasks")
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
      type: "task.completed",
      related_type: "task",
      related_id: id,
      payload: { task_id: id },
    });
  }
  return NextResponse.json({ task: data });
}
