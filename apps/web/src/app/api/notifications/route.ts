import { NextResponse } from "next/server";
import { crmClient } from "@/lib/crmdb";
import { requireOrgId } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  let orgId: string;
  try { orgId = await requireOrgId(); }
  catch (res) { if (res instanceof Response) return res; throw res; }
  const sb = crmClient();
  const [notifs, overdue, today] = await Promise.all([
    sb.from("notifications").select("*").eq("org_id", orgId).order("created_at", { ascending: false }).limit(10),
    sb.from("tasks").select("id", { count: "exact", head: true }).eq("org_id", orgId).neq("status", "completed").lt("due_at", new Date().toISOString()),
    sb.from("tasks").select("id", { count: "exact", head: true }).eq("org_id", orgId).neq("status", "completed").gte("due_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()).lt("due_at", new Date(new Date().setHours(23, 59, 59, 999)).toISOString()),
  ]);

  return NextResponse.json({
    notifications: notifs.data ?? [],
    unread: (notifs.data ?? []).filter((n) => !n.read_at).length,
    overdue_count: overdue.count ?? 0,
    due_today_count: today.count ?? 0,
  });
}

export async function PATCH(req: Request) {
  let orgId: string;
  try { orgId = await requireOrgId(); }
  catch (res) { if (res instanceof Response) return res; throw res; }
  const { id, all } = (await req.json()) as { id?: string; all?: boolean };
  const sb = crmClient();
  const now = new Date().toISOString();
  let q = sb.from("notifications").update({ read_at: now }).eq("org_id", orgId);
  if (id) q = q.eq("id", id);
  if (!id && !all) return NextResponse.json({ error: "id or all required" }, { status: 400 });
  if (all) q = q.is("read_at", null);
  const { error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
