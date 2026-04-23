import { NextResponse } from "next/server";
import { crmClient } from "@/lib/crmdb";
import { requireOrgId } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  let orgId: string;
  try { orgId = await requireOrgId(); }
  catch (res) { if (res instanceof Response) return res; throw res; }
  const sb = crmClient();
  const { data, error } = await sb.from("users_profiles").select("user_id,display_name,role").eq("org_id", orgId).order("display_name");
  if (error) return NextResponse.json({ users: [] });
  return NextResponse.json({ users: data ?? [] });
}
