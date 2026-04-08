import { NextResponse } from "next/server";
import { crmClient, DEFAULT_ORG_ID } from "@/lib/crmdb";
import { emitEvent } from "@/lib/river";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json()) as Record<string, unknown>;
  const sb = crmClient();
  const { data, error } = await sb
    .from("tasks")
    .insert({
      org_id: DEFAULT_ORG_ID,
      title: body.title,
      body: body.body ?? null,
      due_at: body.due_at ?? null,
      status: body.status ?? "not_started",
      assigned_to: body.assigned_to ?? null,
      type: body.type ?? "follow_up",
      priority: body.priority ?? 3,
      related_type: body.related_type ?? null,
      related_id: body.related_id ?? null,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await emitEvent(sb, {
    org_id: DEFAULT_ORG_ID,
    type: "task.created",
    related_type: "task",
    related_id: data.id,
    payload: { task_id: data.id, title: data.title, due_at: data.due_at, type: data.type },
  });

  return NextResponse.json({ task: data });
}

export async function GET() {
  const sb = crmClient();
  const { data, error } = await sb
    .from("tasks")
    .select("*")
    .eq("org_id", DEFAULT_ORG_ID)
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tasks: data });
}
