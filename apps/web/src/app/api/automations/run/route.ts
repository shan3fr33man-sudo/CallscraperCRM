import { NextResponse } from "next/server";
import { crmClient } from "@/lib/crmdb";
import { runAutomations } from "@/lib/river";

export const runtime = "nodejs";

export async function POST() {
  const sb = crmClient();
  const result = await runAutomations(sb, { limit: 200 });
  return NextResponse.json({ ok: true, ...result });
}

export async function GET() {
  return POST();
}
