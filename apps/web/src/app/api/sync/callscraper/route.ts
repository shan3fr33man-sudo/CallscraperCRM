import { NextResponse } from "next/server";
import { runFullSync } from "@/lib/sync-callscraper-v2";
import { getStatus } from "@/lib/sync-state";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const url = new URL(req.url);
  const full = url.searchParams.get("full") === "true";
  try {
    const results = await runFullSync({ fullReconcile: full });
    const total_rows = results.reduce((s, r) => s + r.rows, 0);
    return NextResponse.json({ ok: true, full, results, total_rows });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}

export async function GET() {
  const rows = await getStatus();
  return NextResponse.json({ sync_state: rows });
}
