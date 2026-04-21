import { NextResponse } from "next/server";
import { crmClient } from "@/lib/crmdb";
import { getOrgId } from "@/lib/auth";
import { emitEvent } from "@/lib/river";

export const runtime = "nodejs";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as { starts_at?: string; ends_at?: string; title?: string; location?: string };
  const sb = crmClient();
  const orgId = await getOrgId();
  const update: Record<string, unknown> = {};
  if (body.starts_at) update.starts_at = body.starts_at;
  if (body.ends_at) update.ends_at = body.ends_at;
  if (body.title !== undefined) update.title = body.title;
  if (body.location !== undefined) update.location = body.location;
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  // Cross-tenant safety: scope the update to this org
  const { data, error } = await sb
    .from("calendar_events")
    .update(update)
    .eq("id", id)
    .eq("org_id", orgId)
    .select("*")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await emitEvent(sb, {
    org_id: orgId,
    type: data.kind === "job" ? "job.rescheduled" : "calendar_event.updated",
    related_type: "calendar_event",
    related_id: id,
    payload: { event_id: id, kind: data.kind, starts_at: data.starts_at, ends_at: data.ends_at },
  });

  return NextResponse.json({ event: data });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = crmClient();
  const orgId = await getOrgId();
  // Cross-tenant safety: scope delete to this org
  const { error } = await sb.from("calendar_events").delete().eq("id", id).eq("org_id", orgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
