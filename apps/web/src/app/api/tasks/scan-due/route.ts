import { NextResponse } from "next/server";
import { crmClient, DEFAULT_ORG_ID } from "@/lib/crmdb";
import { emitEvent } from "@/lib/river";

export const runtime = "nodejs";

export async function GET() {
  return POST();
}

export async function POST() {
  const sb = crmClient();
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 3600_000);

  const { data, error } = await sb
    .from("tasks")
    .select("id,title,assigned_to,due_at,org_id")
    .eq("org_id", DEFAULT_ORG_ID)
    .neq("status", "completed")
    .gte("due_at", now.toISOString())
    .lte("due_at", in24h.toISOString())
    .limit(500);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let emitted = 0;
  for (const t of data ?? []) {
    await emitEvent(sb, {
      org_id: t.org_id,
      type: "task.due_soon",
      related_type: "task",
      related_id: t.id,
      payload: { task_id: t.id, title: t.title, assigned_to: t.assigned_to, due_at: t.due_at },
    });
    emitted++;
  }

  return NextResponse.json({ scanned: data?.length ?? 0, events_emitted: emitted });
}
