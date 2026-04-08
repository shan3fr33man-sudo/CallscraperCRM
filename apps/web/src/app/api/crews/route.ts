import { NextResponse } from "next/server";
import { crmClient, DEFAULT_ORG_ID } from "@/lib/crmdb";

export const runtime = "nodejs";

export async function GET() {
  const sb = crmClient();
  const { data, error } = await sb.from("crews").select("*").eq("org_id", DEFAULT_ORG_ID).limit(200);
  if (error) return NextResponse.json({ crews: [] });
  return NextResponse.json({ crews: data ?? [] });
}
