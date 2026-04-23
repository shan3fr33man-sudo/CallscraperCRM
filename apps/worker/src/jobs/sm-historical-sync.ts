/**
 * Historical opportunity harvest from SmartMoving.
 *
 * SmartMoving's External API does NOT expose a list-opportunities endpoint.
 * The access pattern is:
 *   /api/customers (paginated) → /api/customers/{id}/opportunities
 *                             → /api/opportunities/{id} (full detail)
 *
 * So this job walks customers in pages, fetches each customer's opportunity
 * summaries, filters by status (closed-won) and by branch (so APM vs AFM
 * stays clean within a single SM tenant), classifies each into a move-size
 * category, and stops when every (brand, category) bucket has reached its
 * target count.
 *
 * Resumable via `sm_sync_cursor (org_id, brand_code, move_category)` —
 * tracks fetched_count per bucket plus the next customer page to continue
 * from on restart.
 *
 * Run:
 *   SMARTMOVING_API_KEY=... ORG_ID=... BRAND_CODE=APM \
 *     SMARTMOVING_BRANCH_APM="A Perfect Mover" LIMIT_PER_CATEGORY=1000 \
 *     pnpm --filter @callscrapercrm/worker exec tsx src/jobs/sm-historical-sync.ts
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  SmartMovingClient,
  moveCategories,
  type MoveCategory,
  type OpportunityDetail,
} from "@callscrapercrm/smartmoving-api";

export interface HistoricalSyncArgs {
  orgId: string;
  brandCode: string;
  apiKey: string;
  providerKey?: string;
  clientId?: string;
  /** Case-insensitive substring match against the opportunity's branch name. */
  smBranchName?: string;
  limitPerCategory?: number;
  log?: (msg: string, meta?: unknown) => void;
}

type CursorRow = {
  id: string;
  move_category: MoveCategory;
  target_count: number;
  fetched_count: number;
  last_offset: number; // repurposed as "next customer page"
  status: "pending" | "running" | "done" | "failed";
};

const CLOSED_WON_STATUSES = new Set(["Booked", "Completed", "Closed", "closed_won", "Won"]);

export async function runHistoricalSync(args: HistoricalSyncArgs): Promise<void> {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const target = args.limitPerCategory ?? 1000;
  const log = args.log ?? ((m: string, meta?: unknown) => console.log(`[sm-sync] ${m}`, meta ?? ""));
  const client = new SmartMovingClient({
    apiKey: args.apiKey,
    providerKey: args.providerKey,
    clientId: args.clientId,
  });
  const brandNeedle = args.smBranchName?.toLowerCase();

  // One cursor per (org, brand, category). We advance a shared "customer page"
  // across all categories — the smallest of all cursors' last_offset is where
  // we resume the customer walk.
  const cursors: Record<MoveCategory, CursorRow> = {} as never;
  for (const cat of moveCategories) {
    cursors[cat] = await getOrCreateCursor(sb, args.orgId, args.brandCode, cat, target);
  }
  const startPage = Math.max(
    1,
    Math.min(...Object.values(cursors).map((c) => c.last_offset || 1)),
  );

  const bucketsDone = () =>
    moveCategories.every((c) => cursors[c].fetched_count >= target);

  let customerPage = startPage;
  const pageSize = 100;
  log(`Resuming customer walk from page ${customerPage}. Targets per cat: ${target}.`);

  // Transition cursors → running
  for (const cat of moveCategories) {
    if (cursors[cat].status !== "done") {
      await markStatus(sb, cursors[cat].id, "running");
    }
  }

  try {
    while (!bucketsDone()) {
      let customersOnPage = 0;
      for await (const { id: customerId } of client.listCustomers({
        startPage: customerPage,
        pageSize,
        maxItems: pageSize, // single page per outer loop iteration
      })) {
        customersOnPage += 1;
        const opps = await client.listCustomerOpportunities(customerId);
        for (const opp of opps) {
          if (bucketsDone()) break;

          // Branch filter (single tenant, both brands).
          if (brandNeedle) {
            const branchFields = [
              (opp.branch as Record<string, unknown> | undefined)?.name,
              (opp.office as Record<string, unknown> | undefined)?.name,
              opp.branchName,
            ].filter((v): v is string => typeof v === "string");
            if (!branchFields.some((b) => b.toLowerCase().includes(brandNeedle))) continue;
          }

          // Status filter — closed-won family.
          const status = (opp.status as string | undefined) ?? "";
          if (!CLOSED_WON_STATUSES.has(status)) continue;

          // Classify move-size category.
          const category = classifyMoveCategory(opp.moveSize ?? opp.move_size);
          if (!category) continue;
          if (cursors[category].fetched_count >= cursors[category].target_count) continue;

          // Skip duplicates (idempotent re-runs).
          const oppId = opp.id as string | undefined;
          if (!oppId) continue;
          const { data: existing } = await sb
            .from("historical_jobs")
            .select("id")
            .eq("org_id", args.orgId)
            .eq("brand_code", args.brandCode)
            .eq("sm_opportunity_id", oppId)
            .maybeSingle();
          if (existing) {
            cursors[category].fetched_count += 1;
            continue;
          }

          const detail = await client.getOpportunity(oppId);
          await upsertHistoricalJob(sb, args.orgId, args.brandCode, category, detail);
          cursors[category].fetched_count += 1;

          if (cursors[category].fetched_count % 25 === 0) {
            await updateCursor(sb, cursors[category].id, {
              last_offset: customerPage,
              fetched_count: cursors[category].fetched_count,
            });
            log(
              `${args.brandCode}/${category}: ${cursors[category].fetched_count}/${cursors[category].target_count}`,
            );
          }
        }
      }

      // Persist customer-page progress on every cursor so a restart knows
      // where to resume the walk.
      for (const cat of moveCategories) {
        await updateCursor(sb, cursors[cat].id, {
          last_offset: customerPage + 1,
          fetched_count: cursors[cat].fetched_count,
        });
      }

      if (customersOnPage < pageSize) {
        log(`Customer list exhausted at page ${customerPage}. Stopping.`);
        break;
      }
      customerPage += 1;
    }
  } catch (err) {
    for (const cat of moveCategories) {
      await updateCursor(sb, cursors[cat].id, {
        status: "failed",
        last_error: (err as Error).message,
      });
    }
    log(`FAILED: ${(err as Error).message}`);
    throw err;
  }

  // Mark any cursor that reached target as done.
  for (const cat of moveCategories) {
    if (cursors[cat].fetched_count >= cursors[cat].target_count) {
      await updateCursor(sb, cursors[cat].id, {
        status: "done",
        completed_at: new Date().toISOString(),
      });
    }
  }

  log(`Refreshing estimator stats for ${args.orgId}/${args.brandCode}`);
  const { error } = await sb.rpc("refresh_estimator_stats", {
    p_org_id: args.orgId,
    p_brand_code: args.brandCode,
  });
  if (error) log(`refresh_estimator_stats failed: ${error.message}`);
  else log("Stats refreshed.");
}

/**
 * Map an SM move-size label to our normalized category. SM strings vary
 * (e.g., "2 Bedroom", "2BR", "Two Bedroom House"); we normalize conservatively
 * and return null when the string doesn't match a known category.
 */
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

async function getOrCreateCursor(
  sb: SupabaseClient,
  orgId: string,
  brandCode: string,
  category: MoveCategory,
  target: number,
): Promise<CursorRow> {
  const { data: existing } = await sb
    .from("sm_sync_cursor")
    .select("*")
    .eq("org_id", orgId)
    .eq("brand_code", brandCode)
    .eq("move_category", category)
    .maybeSingle();
  if (existing) return existing as CursorRow;
  const { data, error } = await sb
    .from("sm_sync_cursor")
    .insert({
      org_id: orgId,
      brand_code: brandCode,
      move_category: category,
      target_count: target,
      status: "pending",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as CursorRow;
}

async function markStatus(sb: SupabaseClient, cursorId: string, status: string) {
  await sb
    .from("sm_sync_cursor")
    .update({
      status,
      started_at: status === "running" ? new Date().toISOString() : undefined,
      updated_at: new Date().toISOString(),
    })
    .eq("id", cursorId);
}

async function updateCursor(
  sb: SupabaseClient,
  cursorId: string,
  patch: Record<string, unknown>,
) {
  await sb
    .from("sm_sync_cursor")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", cursorId);
}

async function upsertHistoricalJob(
  sb: SupabaseClient,
  orgId: string,
  brandCode: string,
  category: MoveCategory,
  detail: OpportunityDetail,
): Promise<void> {
  const pricing_mode: "local" | "long_distance" =
    detail.linehaul_rate_per_lb ||
    (detail.origin?.state &&
      detail.destination?.state &&
      detail.origin.state !== detail.destination.state)
      ? "long_distance"
      : "local";

  const materials_json: Record<string, { qty: number; unit_price: number | null }> = {};
  for (const m of detail.materials ?? []) {
    const sku = m.sku ?? (m.name ? m.name.toLowerCase().replace(/\s+/g, "_") : null);
    if (!sku) continue;
    materials_json[sku] = {
      qty: Number(m.qty ?? 0),
      unit_price: m.unit_price ?? null,
    };
  }

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
      materials_json,
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
  const limit = process.env.LIMIT_PER_CATEGORY
    ? Number(process.env.LIMIT_PER_CATEGORY)
    : 1000;
  runHistoricalSync({
    orgId,
    brandCode,
    apiKey,
    providerKey,
    clientId,
    smBranchName,
    limitPerCategory: limit,
  })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
