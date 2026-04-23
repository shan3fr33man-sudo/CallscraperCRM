/**
 * Nightly delta sync — picks up new closed-won opportunities since the last
 * run by walking customers (paginated) and fetching their opportunities. Far
 * cheaper than the historical sync because we stop when every matched
 * opportunity in a page is older than the `since` cutoff.
 *
 * Per SmartMoving's API shape, there is no list-opportunities endpoint; we
 * walk `/api/customers` → `/api/customers/{id}/opportunities`. The `since`
 * cutoff is checked against the opportunity's serviceDate (or createdAt when
 * that's present), so once we see a page where every candidate is older, we
 * stop paging.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  SmartMovingClient,
  type MoveCategory,
} from "@callscrapercrm/smartmoving-api";

const CLOSED_WON_STATUSES = new Set(["Booked", "Completed", "Closed", "closed_won", "Won"]);

export interface DeltaSyncArgs {
  orgId: string;
  brandCode: string;
  apiKey: string;
  providerKey?: string;
  clientId?: string;
  smBranchName?: string;
  /** Only consider opportunities dated on/after this timestamp. */
  sinceIso?: string;
  log?: (msg: string, meta?: unknown) => void;
}

export async function runDeltaSync(args: DeltaSyncArgs): Promise<number> {
  const sb: SupabaseClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const log = args.log ?? ((m: string, meta?: unknown) => console.log(`[sm-delta] ${m}`, meta ?? ""));
  const client = new SmartMovingClient({
    apiKey: args.apiKey,
    providerKey: args.providerKey,
    clientId: args.clientId,
  });
  const brandNeedle = args.smBranchName?.toLowerCase();

  const since = args.sinceIso
    ? new Date(args.sinceIso)
    : new Date(Date.now() - 48 * 60 * 60 * 1000);

  let added = 0;
  let oldInARow = 0;
  const OLD_PAGE_STOP = 3; // stop after 3 pages where all candidates are old

  for await (const { id: customerId } of client.listCustomers({ pageSize: 100 })) {
    const opps = await client.listCustomerOpportunities(customerId);
    let pageHadFresh = false;
    for (const opp of opps) {
      // Filter: closed-won + branch + date.
      if (brandNeedle) {
        const branchFields = [
          (opp.branch as Record<string, unknown> | undefined)?.name,
          (opp.office as Record<string, unknown> | undefined)?.name,
          opp.branchName,
        ].filter((v): v is string => typeof v === "string");
        if (!branchFields.some((b) => b.toLowerCase().includes(brandNeedle))) continue;
      }
      const status = (opp.status as string | undefined) ?? "";
      if (!CLOSED_WON_STATUSES.has(status)) continue;

      const serviceDate = opp.serviceDate ?? opp.service_date;
      const d = typeof serviceDate === "string" ? new Date(serviceDate) : null;
      if (d && d < since) continue;
      pageHadFresh = true;

      const category = classifyMoveCategory(opp.moveSize ?? opp.move_size);
      if (!category) continue;
      const oppId = opp.id as string | undefined;
      if (!oppId) continue;

      const { data: existing } = await sb
        .from("historical_jobs")
        .select("id")
        .eq("org_id", args.orgId)
        .eq("brand_code", args.brandCode)
        .eq("sm_opportunity_id", oppId)
        .maybeSingle();
      if (existing) continue;

      const detail = await client.getOpportunity(oppId);
      await upsertHistoricalJob(sb, args.orgId, args.brandCode, category, detail);
      added += 1;
    }
    if (!pageHadFresh) {
      oldInARow += 1;
      if (oldInARow >= OLD_PAGE_STOP) break;
    } else {
      oldInARow = 0;
    }
  }

  if (added > 0) {
    log(`Refreshing estimator stats (+${added} new jobs) for ${args.brandCode}`);
    const { error } = await sb.rpc("refresh_estimator_stats", {
      p_org_id: args.orgId,
      p_brand_code: args.brandCode,
    });
    if (error) log(`refresh_estimator_stats failed: ${error.message}`);
  }

  log(`Delta sync complete: ${added} new jobs for ${args.brandCode}`);
  return added;
}

function classifyMoveCategory(smMoveSize: unknown): MoveCategory | null {
  if (typeof smMoveSize !== "string") return null;
  const s = smMoveSize.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (s.includes("1bedroom") || s.includes("1br") || s.includes("onebedroom")) return "1br";
  if (s.includes("2bedroom") || s.includes("2br") || s.includes("twobedroom")) return "2br";
  if (s.includes("3bedroom") || s.includes("3br") || s.includes("threebedroom")) return "3br";
  if (s.includes("condo")) return "condo";
  if (s.includes("townhouse") || s.includes("townhome")) return "townhouse";
  if (s.includes("commercial") || s.includes("office")) return "commercial";
  if (s.includes("singleitem") || s.includes("single")) return "single_item";
  if (s.includes("apartment") || s.includes("apt") || s.includes("studio")) return "apartment";
  return null;
}

async function upsertHistoricalJob(
  sb: SupabaseClient,
  orgId: string,
  brandCode: string,
  category: MoveCategory,
  detail: import("@callscrapercrm/smartmoving-api").OpportunityDetail,
): Promise<void> {
  const pricing_mode: "local" | "long_distance" =
    detail.linehaul_rate_per_lb ||
    (detail.origin?.state &&
      detail.destination?.state &&
      detail.origin.state !== detail.destination.state)
      ? "long_distance"
      : "local";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stripped: any = { ...detail };
  delete stripped.inventory_photos;
  delete stripped.transcript;

  await sb.from("historical_jobs").upsert(
    {
      org_id: orgId,
      brand_code: brandCode,
      sm_opportunity_id: detail.id,
      move_category: category,
      pricing_mode,
      origin_zip: detail.origin?.zip ?? null,
      dest_zip: detail.destination?.zip ?? null,
      origin_state: detail.origin?.state ?? null,
      dest_state: detail.destination?.state ?? null,
      service_date: detail.service_date ?? null,
      crew_size: detail.crew_size ?? null,
      truck_size: detail.truck_size ?? null,
      billed_hours: detail.billed_hours ?? null,
      total_miles: detail.total_miles ?? null,
      total_weight_lb: detail.total_weight_lb ?? null,
      total_cu_ft: detail.total_cu_ft ?? null,
      total_amount: detail.total_amount ?? null,
      linehaul_rate_per_lb: detail.linehaul_rate_per_lb ?? null,
      fuel_surcharge_pct: detail.fuel_surcharge_pct ?? null,
      deadhead_miles: detail.deadhead_miles ?? null,
      shuttle_fee: detail.shuttle_fee ?? null,
      long_haul_prep_fee: detail.long_haul_prep_fee ?? null,
      crating_fees: detail.crating_fees ?? null,
      materials_json: {},
      inventory_json: detail.inventory ?? [],
      valuation_type: detail.valuation_type ?? null,
      declared_value: detail.declared_value ?? null,
      access_json: detail.access ?? {},
      raw_payload: stripped,
    },
    { onConflict: "org_id,brand_code,sm_opportunity_id" },
  );
}

// CLI entry
if (import.meta.url === `file://${process.argv[1]}`) {
  const orgId = process.env.ORG_ID;
  const brandCode = process.env.BRAND_CODE;
  const apiKey = process.env.SMARTMOVING_API_KEY ?? process.env.SM_API_KEY;
  const providerKey = process.env.SMARTMOVING_PROVIDER_KEY;
  const clientId = process.env.SMARTMOVING_CLIENT_ID;
  const smBranchName =
    process.env[`SMARTMOVING_BRANCH_${brandCode?.toUpperCase()}`] ??
    process.env.SMARTMOVING_BRANCH_NAME ??
    (brandCode === "APM" ? "A Perfect Mover" : brandCode === "AFM" ? "Affordable Movers" : undefined);
  if (!orgId || !brandCode || !apiKey) {
    console.error(
      "ORG_ID, BRAND_CODE, and SMARTMOVING_API_KEY env vars required (SMARTMOVING_PROVIDER_KEY + SMARTMOVING_CLIENT_ID optional)",
    );
    process.exit(1);
  }
  runDeltaSync({
    orgId,
    brandCode,
    apiKey,
    providerKey,
    clientId,
    smBranchName,
    sinceIso: process.env.SINCE_ISO,
  })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
