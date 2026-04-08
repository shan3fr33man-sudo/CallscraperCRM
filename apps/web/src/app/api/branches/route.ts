import { NextResponse } from "next/server";
import { crmClient, DEFAULT_ORG_ID } from "@/lib/crmdb";

export const runtime = "nodejs";

export async function GET() {
  const sb = crmClient();
  const { data, error } = await sb.from("branches").select("*").eq("org_id", DEFAULT_ORG_ID).order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ branches: data });
}
