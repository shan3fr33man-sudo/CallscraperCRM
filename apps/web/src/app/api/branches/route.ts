import { NextResponse } from "next/server";
import { crmClient } from "@/lib/crmdb";
import { getOrgId } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const sb = crmClient();
  const orgId = await getOrgId();
  const { data, error } = await sb.from("branches").select("*").eq("org_id", orgId).order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ branches: data });
}
