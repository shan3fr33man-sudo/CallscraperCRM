import { NextResponse } from "next/server";
import { crmClient } from "@/lib/crmdb";
import { getOrgId } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const sb = crmClient();
  const orgId = await getOrgId();
  const { data, error } = await sb.from("crews").select("*").eq("org_id", orgId).limit(200);
  if (error) return NextResponse.json({ crews: [] });
  return NextResponse.json({ crews: data ?? [] });
}
