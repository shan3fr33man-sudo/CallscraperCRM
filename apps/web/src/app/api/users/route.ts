import { NextResponse } from "next/server";
import { crmClient, DEFAULT_ORG_ID } from "@/lib/crmdb";

export const runtime = "nodejs";

export async function GET() {
  const sb = crmClient();
  const { data, error } = await sb.from("users_profiles").select("user_id,display_name,role").eq("org_id", DEFAULT_ORG_ID).order("display_name");
  if (error) return NextResponse.json({ users: [] });
  return NextResponse.json({ users: data ?? [] });
}
