import { NextResponse } from "next/server";
import { crmClient, DEFAULT_ORG_ID } from "@/lib/crmdb";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json()) as Record<string, unknown>;
  const sb = crmClient();
  const { data, error } = await sb
    .from("calendar_events")
    .insert({
      org_id: DEFAULT_ORG_ID,
      kind: body.kind ?? "office",
      event_type: body.event_type ?? "other",
      title: body.title,
      starts_at: body.starts_at,
      ends_at: body.ends_at,
      all_day: body.all_day ?? false,
      owner_id: body.owner_id ?? null,
      branch_id: body.branch_id ?? null,
      related_type: body.related_type ?? null,
      related_id: body.related_id ?? null,
      location: body.location ?? null,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ event: data });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind");
  const sb = crmClient();
  let q = sb.from("calendar_events").select("*").eq("org_id", DEFAULT_ORG_ID).order("starts_at", { ascending: true }).limit(200);
  if (kind) q = q.eq("kind", kind);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ events: data });
}
