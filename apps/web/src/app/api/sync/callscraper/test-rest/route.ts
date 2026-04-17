import { NextResponse } from "next/server";
import { crmClient } from "@/lib/crmdb";
import { getOrgId } from "@/lib/auth";
import { callscraperRestClient, CallscraperApiError } from "@/lib/callscraper-rest";

export const runtime = "nodejs";

/**
 * GET /api/sync/callscraper/test-rest
 * Tests the CallScraper REST API connection using the stored API key.
 */
export async function GET() {
  try {
    const orgId = await getOrgId();
    const sb = crmClient();

    // Try to load API key from integration_credentials
    const { data: cred } = await sb
      .from("integration_credentials")
      .select("secrets")
      .eq("org_id", orgId)
      .eq("provider_key", "callscraper")
      .eq("enabled", true)
      .maybeSingle();

    const apiKey = (cred?.secrets as { key?: string } | null)?.key ?? process.env.CALLSCRAPER_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        ok: false,
        status: "not_configured",
        error: "No CallScraper API key configured. Add one in Settings → Integrations → API Keys.",
      });
    }

    const client = callscraperRestClient({ apiKey });
    const result = await client.healthCheck();

    return NextResponse.json({
      ok: result.ok,
      status: result.ok ? "connected" : "unreachable",
      latency_ms: result.latency_ms,
      error: result.error ?? null,
    });
  } catch (e) {
    if (e instanceof CallscraperApiError) {
      return NextResponse.json({
        ok: false,
        status: "error",
        error: e.message,
        http_status: e.status,
      });
    }
    return NextResponse.json({
      ok: false,
      status: "error",
      error: (e as Error).message,
    }, { status: 500 });
  }
}
