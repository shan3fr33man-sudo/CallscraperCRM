import { NextResponse } from "next/server";
import { crmClient } from "@/lib/crmdb";
import { getOrgId } from "@/lib/auth";
import { emitEvent } from "@/lib/river";

export const runtime = "nodejs";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as Record<string, unknown>;
  const sb = crmClient();
  const orgId = await getOrgId();
  const { data, error } = await sb.from("jobs").update(body).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (typeof body.status === "string") {
    await emitEvent(sb, {
      org_id: orgId,
      type: `job.${body.status}`,
      related_type: "job",
      related_id: id,
      payload: { job_id: id, status: body.status },
    });
  }
  return NextResponse.json({ job: data });
}
