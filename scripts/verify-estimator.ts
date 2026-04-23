#!/usr/bin/env tsx
/**
 * Estimator end-to-end smoke test.
 *
 * Constructs a realistic CallScraper-v3 payload, HMAC-signs it with the
 * same secret the subscriber uses, POSTs to /api/webhooks/callscraper on
 * your target environment, and verifies the response.
 *
 * Run:
 *   CRM_WEBHOOK_URL=https://<host>/api/webhooks/callscraper \
 *   CALLSCRAPER_WEBHOOK_SECRET=<same secret webhook uses> \
 *   tsx scripts/verify-estimator.ts [--brand APM] [--long-distance]
 *
 * Exits 0 on success, 1 on any check failing. Safe to run repeatedly:
 * uses a random sessionId so the webhook creates a fresh opportunity +
 * estimate row each run (pass --session <id> to reuse).
 */
import { createHmac, randomUUID } from "node:crypto";

interface Args {
  webhookUrl: string;
  secret: string;
  brand: "APM" | "AFM" | "crewready" | "apex";
  longDistance: boolean;
  sessionId: string;
}

function parseArgs(): Args {
  const webhookUrl = process.env.CRM_WEBHOOK_URL;
  const secret = process.env.CALLSCRAPER_WEBHOOK_SECRET;
  if (!webhookUrl || !secret) {
    console.error("Set CRM_WEBHOOK_URL and CALLSCRAPER_WEBHOOK_SECRET env vars.");
    process.exit(1);
  }
  const argv = process.argv.slice(2);
  const getFlag = (name: string) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  return {
    webhookUrl,
    secret,
    brand: ((getFlag("--brand") as Args["brand"]) ?? "APM"),
    longDistance: argv.includes("--long-distance"),
    sessionId: getFlag("--session") ?? `smoke-${randomUUID().slice(0, 8)}`,
  };
}

function buildPayload(args: Args) {
  return {
    event: "call.completed" as const,
    source: "smoke-test" as const,
    sessionId: args.sessionId,
    company: args.brand,
    extensionId: "smoke-ext-001",
    direction: "inbound" as const,
    agentName: "Smoke Test",
    startedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    endedAt: new Date().toISOString(),
    caller: {
      phone: "5555551234",
      phoneDisplay: "(555) 555-1234",
      name: "Smoke Test Customer",
      rcName: "Smoke Test Customer",
      email: "smoke@example.com",
    },
    sm: { found: false, smType: "unknown" },
    addresses: args.longDistance
      ? {
          originAddress: "2918 South Ledbetter Place, Kennewick, WA 99337",
          destinationAddress: "309 North Palmetto Avenue, Marshfield, WI 54449",
        }
      : {
          originAddress: "400 Broad St, Seattle, WA 98109",
          destinationAddress: "85 Pike St, Seattle, WA 98101",
        },
    summary: {
      intent: "New move estimate request",
      text: args.longDistance
        ? `Customer wants to move from Kennewick WA to Marshfield WI on June 15. Three bedroom house. Living room has a sectional sofa, a recliner, a 75 inch TV with original box. Master bedroom has a queen bed with boxspring, a five-drawer dresser. Garage has a chest freezer, two bikes, an electric scooter. About 15 boxes estimated per room. Origin has a private driveway.`
        : `Customer wants to move from Seattle Broadway to Seattle Pike. Two bedroom apartment. Living room has a sofa, coffee table, 55 inch TV, and about 12 boxes. Bedroom has a queen bed, dresser, nightstand. Kitchen has standard appliances and about 10 boxes. Second bedroom has a desk and some boxes.`,
      crewEstimate: args.longDistance ? "4" : "3",
      truckEstimate: args.longDistance ? "26ft" : "17ft",
      tags: args.longDistance ? ["long-distance", "binding"] : ["local", "deposit"],
      callOutcome: "booked",
      moveSize: args.longDistance ? "3br" : "2br",
      moveDate: args.longDistance ? "2026-06-15" : "2026-05-10",
    },
    callTags: args.longDistance ? ["long-distance"] : ["local"],
    callCount: 1,
  };
}

async function main() {
  const args = parseArgs();
  const payload = buildPayload(args);
  const raw = JSON.stringify(payload);
  const sig = createHmac("sha256", args.secret).update(raw).digest("hex");

  console.log(`▶ POST ${args.webhookUrl}`);
  console.log(`  brand=${args.brand} session=${args.sessionId} ld=${args.longDistance}`);

  const res = await fetch(args.webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json", "x-callscraper-signature": sig },
    body: raw,
  });

  const bodyText = await res.text();
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(bodyText);
  } catch {
    /* leave body raw */
  }

  console.log(`  status=${res.status}`);
  console.log(`  body=${JSON.stringify(body, null, 2)}`);

  if (!res.ok) {
    console.error("❌ Webhook rejected the payload.");
    process.exit(1);
  }
  const required = ["opportunity_id", "estimate_id", "brand_code"];
  for (const key of required) {
    if (body[key] === undefined || body[key] === null) {
      if (key === "estimate_id" && body["auto_generated"] === false) {
        console.warn("⚠ estimate_id is null — margin likely blocked. Not a failure.");
        continue;
      }
      console.error(`❌ Response missing ${key}`);
      process.exit(1);
    }
  }
  console.log(`✅ opportunity_id=${body.opportunity_id} estimate_id=${body.estimate_id}`);

  // Re-POST to verify idempotency.
  console.log(`\n▶ Re-POST for idempotency check`);
  const res2 = await fetch(args.webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json", "x-callscraper-signature": sig },
    body: raw,
  });
  const body2 = (await res2.json().catch(() => ({}))) as Record<string, unknown>;
  if (body2.idempotent !== true) {
    console.error("❌ Idempotency short-circuit not hit on second delivery");
    process.exit(1);
  }
  console.log("✅ second delivery was idempotent (existing ids returned)");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Unhandled error:", err);
  process.exit(1);
});
