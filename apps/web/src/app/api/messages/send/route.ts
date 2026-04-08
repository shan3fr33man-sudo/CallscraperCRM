import { NextResponse } from "next/server";
import { crmClient, DEFAULT_ORG_ID } from "@/lib/crmdb";
import { emitEvent } from "@/lib/river";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json()) as Record<string, unknown>;
  const sb = crmClient();
  const { data, error } = await sb
    .from("sms_logs")
    .insert({
      org_id: DEFAULT_ORG_ID,
      template_key: body.template_key ?? null,
      to_number: body.to_number ?? null,
      from_number: body.from_number ?? null,
      message: body.message ?? null,
      status: "queued",
      related_type: body.related_type ?? null,
      related_id: body.related_id ?? null,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await emitEvent(sb, {
    org_id: DEFAULT_ORG_ID,
    type: "message.queued",
    related_type: String(body.related_type ?? "message"),
    related_id: String(body.related_id ?? data.id),
    payload: { template_key: body.template_key, sms_id: data.id },
  });
  return NextResponse.json({ message: data });
}
