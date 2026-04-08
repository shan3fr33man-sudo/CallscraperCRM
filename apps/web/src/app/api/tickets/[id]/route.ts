import { NextResponse } from "next/server";
import { crmClient, DEFAULT_ORG_ID } from "@/lib/crmdb";
import { emitEvent } from "@/lib/river";

export const runtime = "nodejs";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as Record<string, unknown>;
  const sb = crmClient();
  const { data, error } = await sb.from("tickets").update(body).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (body.status === "completed") {
    await emitEvent(sb, { org_id: DEFAULT_ORG_ID, type: "ticket.closed", related_type: "ticket", related_id: id, payload: { ticket_id: id } });
  }
  if (body.priority === "critical") {
    await emitEvent(sb, { org_id: DEFAULT_ORG_ID, type: "ticket.escalated", related_type: "ticket", related_id: id, payload: { ticket_id: id } });
  }
  return NextResponse.json({ ticket: data });
}
