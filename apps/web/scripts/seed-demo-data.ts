#!/usr/bin/env node
/**
 * Seed the dev/review environment with a small but complete end-to-end data set.
 *
 * Creates (idempotently):
 *   - 3 customers (one with prior opp, one brand new, one with storage)
 *   - 3 opportunities tied to those customers
 *   - 3 call activities with realistic payloads (summary, transcript, key_details)
 *   - 1 calendar event (office: on_site_estimate)
 *   - 1 task (due-today follow-up)
 *
 * Safe to re-run: every insert is idempotent on a deterministic key, either
 * via UNIQUE constraints or explicit existence checks.
 *
 * Usage (from repo root, with apps/web/.env.local populated):
 *   pnpm --filter @callscrapercrm/web seed
 * Or directly:
 *   cd apps/web && node --experimental-strip-types scripts/seed-demo-data.ts
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL in env.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const APP_ROOT = join(import.meta.dirname, "..");
const ENV_FILE = join(APP_ROOT, ".env.local");
const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";

// ─── Minimal .env loader ────────────────────────────────────────────
function loadDotEnv(path: string) {
  if (!existsSync(path)) return;
  const body = readFileSync(path, "utf8");
  for (const line of body.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/i);
    if (!m) continue;
    if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

loadDotEnv(ENV_FILE);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.");
  console.error("Copy .env.production.example to apps/web/.env.local and fill in values.");
  process.exit(1);
}

const sb: SupabaseClient = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ─── Upsert helpers ─────────────────────────────────────────────────
async function upsertCustomer(customer: {
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  brand: string;
}): Promise<string> {
  // The DB has a partial UNIQUE index on (org_id, customer_phone) — partial
  // because phone may be empty. Supabase's .upsert() can't target a partial
  // index, so use the explicit select-then-insert pattern.
  const { data: existing } = await sb
    .from("customers")
    .select("id")
    .eq("org_id", DEFAULT_ORG_ID)
    .eq("customer_phone", customer.customer_phone)
    .maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await sb
    .from("customers")
    .insert({ org_id: DEFAULT_ORG_ID, status: "new", ...customer })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function upsertOpportunity(opp: {
  customer_id: string;
  move_type: string;
  status: string;
  amount?: number | null;
  service_date?: string | null;
  source: string;
}): Promise<string> {
  // Use an explicit existence check since there's no natural unique key
  const { data: existing } = await sb
    .from("opportunities")
    .select("id")
    .eq("customer_id", opp.customer_id)
    .eq("org_id", DEFAULT_ORG_ID)
    .eq("move_type", opp.move_type)
    .maybeSingle();
  if (existing) return existing.id;

  const { data, error } = await sb
    .from("opportunities")
    .insert({ org_id: DEFAULT_ORG_ID, ...opp })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function upsertActivity(act: {
  record_id: string;
  kind: "call";
  external_id: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  // Idempotent on (kind, payload->>external_id)
  const { data: existing } = await sb
    .from("activities")
    .select("id")
    .eq("kind", "call")
    .eq("payload->>external_id", act.external_id)
    .maybeSingle();
  if (existing) return;

  const { error } = await sb.from("activities").insert({
    org_id: DEFAULT_ORG_ID,
    record_id: act.record_id,
    kind: act.kind,
    payload: { external_id: act.external_id, ...act.payload },
  });
  if (error) throw error;
}

async function upsertCalendarEvent(ev: {
  title: string;
  event_type: string;
  starts_at: string;
  related_id: string;
  related_type: string;
}): Promise<void> {
  const { data: existing } = await sb
    .from("calendar_events")
    .select("id")
    .eq("org_id", DEFAULT_ORG_ID)
    .eq("title", ev.title)
    .eq("starts_at", ev.starts_at)
    .maybeSingle();
  if (existing) return;
  const endsAt = new Date(new Date(ev.starts_at).getTime() + 60 * 60 * 1000).toISOString();
  const { error } = await sb.from("calendar_events").insert({
    org_id: DEFAULT_ORG_ID,
    kind: "office",
    ends_at: endsAt,
    ...ev,
  });
  if (error) throw error;
}

async function upsertTask(task: {
  title: string;
  due_at: string;
  related_id: string;
  related_type: string;
}): Promise<void> {
  const { data: existing } = await sb
    .from("tasks")
    .select("id")
    .eq("org_id", DEFAULT_ORG_ID)
    .eq("title", task.title)
    .eq("related_id", task.related_id)
    .maybeSingle();
  if (existing) return;
  const { error } = await sb.from("tasks").insert({
    org_id: DEFAULT_ORG_ID,
    status: "not_started",
    type: "follow_up",
    priority: 2,
    ...task,
  });
  if (error) throw error;
}

// ─── Seed payload ───────────────────────────────────────────────────
async function main() {
  const now = new Date();
  const futureDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  console.log("Seeding demo customers...");
  const alice = await upsertCustomer({
    customer_name: "Alice Demo",
    customer_phone: "+12065550101",
    customer_email: "alice@example.com",
    brand: "APM",
  });
  const bob = await upsertCustomer({
    customer_name: "Bob Demo",
    customer_phone: "+12065550102",
    customer_email: "bob@example.com",
    brand: "AFM",
  });
  const carol = await upsertCustomer({
    customer_name: "Carol Demo",
    customer_phone: "+12065550103",
    customer_email: "carol@example.com",
    brand: "APM",
  });

  console.log("Seeding opportunities...");
  const aliceOpp = await upsertOpportunity({
    customer_id: alice,
    move_type: "local_move",
    status: "new",
    amount: 2800,
    service_date: futureDate,
    source: "callscraper",
  });
  const bobOpp = await upsertOpportunity({
    customer_id: bob,
    move_type: "local_move",
    status: "quoted",
    amount: 1800,
    service_date: futureDate,
    source: "referral",
  });
  const carolOpp = await upsertOpportunity({
    customer_id: carol,
    move_type: "long_distance",
    status: "new",
    amount: null,
    service_date: null,
    source: "web",
  });

  console.log("Seeding call activities...");
  await upsertActivity({
    record_id: alice,
    kind: "call",
    external_id: "demo-call-alice-1",
    payload: {
      from_number: "+12065550101",
      to_number: "+18005551000",
      duration_seconds: 312,
      direction: "inbound",
      call_outcome: "quoted",
      brand: "APM",
      started_at: new Date(now.getTime() - 3 * 86400_000).toISOString(),
      summary: "Alice called about a 2-bedroom move from Ballard to Bellevue on " + futureDate + ". Quoted $2800 for 3 movers + truck.",
      sentiment: "positive",
      intent: "ready_to_book",
      lead_quality: "hot",
      move_type: "local_move",
      move_date: futureDate,
      price_quoted: "2800",
      key_details: {
        moveType: "local",
        moveSize: "2br",
        originAddress: "1234 Ballard Ave NW, Seattle, WA",
        destinationAddress: "5678 NE 8th St, Bellevue, WA",
        crewEstimate: 3,
        priceQuoted: "$2800",
      },
    },
  });
  await upsertActivity({
    record_id: bob,
    kind: "call",
    external_id: "demo-call-bob-1",
    payload: {
      from_number: "+12065550102",
      duration_seconds: 180,
      direction: "inbound",
      call_outcome: "quoted",
      brand: "AFM",
      summary: "Bob wants to book a studio move across town.",
      sentiment: "neutral",
      lead_quality: "warm",
      move_type: "local_move",
    },
  });
  await upsertActivity({
    record_id: carol,
    kind: "call",
    external_id: "demo-call-carol-1",
    payload: {
      from_number: "+12065550103",
      duration_seconds: 540,
      direction: "inbound",
      call_outcome: "lead",
      brand: "APM",
      summary: "Carol is researching long-distance to Portland; no date yet.",
      sentiment: "neutral",
      lead_quality: "cold",
      intent: "researching",
    },
  });

  console.log("Seeding calendar event...");
  await upsertCalendarEvent({
    title: "On-site estimate — Alice Demo",
    event_type: "on_site_estimate",
    starts_at: new Date(now.getTime() + 2 * 86400_000).toISOString(),
    related_id: aliceOpp,
    related_type: "opportunity",
  });

  console.log("Seeding follow-up task...");
  await upsertTask({
    title: "Follow up with Bob on 1BR quote",
    due_at: new Date(now.getTime() + 86400_000).toISOString(),
    related_id: bobOpp,
    related_type: "opportunity",
  });

  // ─── Estimate for Alice (gives reviewers a signable lifecycle to inspect) ──
  console.log("Seeding draft estimate for Alice...");
  let aliceEstimate: string | null = null;
  // Look up the default APM tariff to drive the engine
  const { data: apmTariff } = await sb
    .from("tariffs")
    .select("id")
    .eq("org_id", DEFAULT_ORG_ID)
    .eq("name", "APM Standard Local")
    .maybeSingle();
  if (apmTariff) {
    // Idempotency: skip if Alice already has a non-accepted estimate
    const { data: existing } = await sb
      .from("estimates")
      .select("id, accepted_at")
      .eq("opportunity_id", aliceOpp)
      .eq("org_id", DEFAULT_ORG_ID)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing) {
      aliceEstimate = existing.id;
      console.log(`  (existing estimate ${aliceEstimate}; signed: ${Boolean(existing.accepted_at)})`);
    } else {
      // Create estimate via direct insert (mirrors what /api/estimates engine path produces)
      const lineItems = [
        { label: "Mover (per hour)", kind: "labor", rate: 175, quantity: 12, unit: "hour", subtotal: 2100 },
        { label: "Truck (per hour)", kind: "truck", rate: 125, quantity: 4, unit: "hour", subtotal: 500 },
        { label: "Travel fee", kind: "travel", rate: 150, quantity: 1, unit: "flat", subtotal: 150 },
      ];
      const subtotal = 2750;
      const tax = Math.round(subtotal * 0.089 * 100) / 100;
      const { data: estimate } = await sb
        .from("estimates")
        .insert({
          org_id: DEFAULT_ORG_ID,
          opportunity_id: aliceOpp,
          tariff_id: apmTariff.id,
          estimate_type: "non_binding",
          estimate_number: "DEMO-ALICE",
          charges_json: lineItems,
          subtotal,
          discounts: 0,
          sales_tax: tax,
          amount: subtotal + tax,
          deposit_amount: 250,
          valid_until: futureDate,
        })
        .select("id")
        .single();
      aliceEstimate = estimate?.id ?? null;
    }
  }

  // Silence unused-variable lint on carolOpp — intentionally un-scheduled
  void carolOpp;

  console.log("\n✅ Demo data seeded for org", DEFAULT_ORG_ID);
  console.log("Customers:", [alice, bob, carol].map((id) => `  - ${id}`).join("\n"));
  console.log("Opportunities:", [aliceOpp, bobOpp, carolOpp].map((id) => `  - ${id}`).join("\n"));
  if (aliceEstimate) {
    console.log("\nDraft estimate for Alice:", aliceEstimate);
    console.log("To exercise the full lifecycle:");
    console.log("  1. POST /api/estimates/" + aliceEstimate + "/send  → mints HMAC token, writes email_log");
    console.log("  2. Open the returned view_url, sign with the canvas");
    console.log("  3. Watch /api/automations/run create the auto-invoice");
    console.log("  4. POST /api/payments with that invoice_id to trigger the rollup trigger");
  }
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
