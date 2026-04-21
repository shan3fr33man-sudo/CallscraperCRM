import { NextResponse } from "next/server";
import { crmClient } from "@/lib/crmdb";
import { getOrgId } from "@/lib/auth";
import { emitEvent } from "@/lib/river";

export const runtime = "nodejs";

const COLOR_BY_TYPE: Record<string, string> = {
  on_site_estimate: "#3B82F6",
  virtual_survey: "#8B5CF6",
  phone_survey: "#F59E0B",
  box_delivery: "#10B981",
  liveswitch_survey: "#EC4899",
  other: "#6B7280",
  move: "#EF4444",
};

type Row = {
  id: string;
  title: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean | null;
  kind: string;
  event_type: string | null;
  related_type: string | null;
  related_id: string | null;
  branch_id: string | null;
  owner_id: string | null;
  color: string | null;
  location: string | null;
};

export async function POST(req: Request) {
  const body = (await req.json()) as Record<string, unknown>;
  const sb = crmClient();
  const orgId = await getOrgId();
  const { data, error } = await sb
    .from("calendar_events")
    .insert({
      org_id: orgId,
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

  await emitEvent(sb, {
    org_id: orgId,
    type: "calendar_event.created",
    related_type: "calendar_event",
    related_id: data.id,
    payload: { event_id: data.id, kind: data.kind, event_type: data.event_type, starts_at: data.starts_at },
  });

  return NextResponse.json({ event: data });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind");
  const branchId = url.searchParams.get("branch_id");
  const ownerId = url.searchParams.get("owner_id");
  const eventType = url.searchParams.get("event_type");
  // `related_type` is used by the Follow-ups calendar to narrow to
  // task-linked office events ("/calendars/follow-ups"). The fleet of
  // non-follow-up office events (e.g. surveys, box deliveries) does NOT
  // have related_type="task", so this filter cleanly separates them.
  const relatedType = url.searchParams.get("related_type");
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");

  const sb = crmClient();
  const orgId = await getOrgId();
  let q = sb.from("calendar_events").select("*").eq("org_id", orgId).order("starts_at", { ascending: true }).limit(500);
  if (kind) q = q.eq("kind", kind);
  if (branchId) q = q.eq("branch_id", branchId);
  if (ownerId) q = q.eq("owner_id", ownerId);
  if (eventType) q = q.eq("event_type", eventType);
  if (relatedType) q = q.eq("related_type", relatedType);
  if (start) q = q.gte("starts_at", start);
  if (end) q = q.lte("starts_at", end);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const events = ((data ?? []) as Row[]).map((r) => ({
    id: r.id,
    title: r.title ?? "(untitled)",
    start: r.starts_at,
    end: r.ends_at,
    allDay: r.all_day ?? false,
    color: r.color ?? COLOR_BY_TYPE[r.event_type ?? "other"] ?? "#6B7280",
    extendedProps: {
      kind: r.kind,
      event_type: r.event_type,
      related_type: r.related_type,
      related_id: r.related_id,
      branch_id: r.branch_id,
      owner_id: r.owner_id,
      location: r.location,
    },
  }));

  return NextResponse.json({ events });
}
