import { NextResponse } from "next/server";
import { crmClient } from "@/lib/crmdb";
import { requireOrgId } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  let orgId: string;
  try { orgId = await requireOrgId(); }
  catch (res) { if (res instanceof Response) return res; throw res; }
  const sb = crmClient();
  const { data, error } = await sb.from("crews").select("*").eq("org_id", orgId).limit(200);
  if (error) return NextResponse.json({ crews: [] });
  return NextResponse.json({ crews: data ?? [] });
}
