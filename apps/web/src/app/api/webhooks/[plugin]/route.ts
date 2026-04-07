import { NextResponse } from "next/server";

/**
 * Universal webhook entry point. Each installed plugin registers a webhook
 * adapter; this route looks it up by `plugin` and dispatches.
 *
 * For v0 we only ship the `callscraper` plugin — wired in the worker.
 */
export async function POST(req: Request, { params }: { params: Promise<{ plugin: string }> }) {
  const { plugin } = await params;
  const rawBody = await req.text();
  const headers = Object.fromEntries(req.headers.entries());

  // TODO: load plugin from registry, verify signature, dispatch handle().
  return NextResponse.json({ ok: true, plugin, bytes: rawBody.length, headers: Object.keys(headers).length });
}
