/**
 * Supabase-backed implementation of EstimatorDataSource.
 *
 * Lives in the web app (not the estimator package) because it's tightly
 * coupled to our Supabase service-role client and cache tables. The estimator
 * package stays pure TS so it's unit-testable with fixture data sources.
 *
 * All reads are scoped on `(org_id, brand_code)` per migration 0013.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  analyzeDrivewayFromStreetView,
  GoogleDistanceMatrix,
  type BranchConfig,
  type DrivewayFlags,
  type EstimatorDataSource,
  type MarginPolicy,
  type MaterialPatternRow,
  type MoveSizeStatRow,
  type PricingMode,
  type ValuationPatternRow,
} from "@callscrapercrm/estimator";

export interface SupabaseDataSourceOpts {
  sb: SupabaseClient;
  anthropicApiKey?: string;
  googleMapsApiKey?: string;
}

/** Conservative defaults used when no branch_config row exists. Prefer seeding
 *  via migration 0014; these are the fall-through guard. */
const DEFAULT_BRANCH_CONFIG: BranchConfig = {
  rate_base_2man_1truck: 199,
  rate_per_extra_man: 50,
  rate_per_extra_truck: 50,
  burdened_per_worker_hour: 35,
  truck_cost_per_hour: 16,
  deadhead_cost_per_mile: 3.0,
  sales_tax_pct: 0.09,
  default_shuttle_fee: 900,
  default_long_haul_prep_fee: 300,
  default_tv_crating_fee: 150,
  default_specialty_fee: 250,
  default_fuel_surcharge_pct: 0.12,
  linehaul_rate_mode: "midpoint",
};

export function createSupabaseEstimatorDataSource(
  opts: SupabaseDataSourceOpts,
): EstimatorDataSource {
  const { sb, anthropicApiKey, googleMapsApiKey } = opts;

  return {
    async moveSizeStats(args) {
      const { data } = await sb
        .from("move_size_stats")
        .select("*")
        .eq("org_id", args.orgId)
        .eq("brand_code", args.brandCode)
        .eq("move_category", args.moveCategory)
        .eq("pricing_mode", args.pricingMode)
        .eq("distance_bucket", args.distanceBucket)
        .eq("season", args.season)
        .maybeSingle();
      return (data as MoveSizeStatRow | null) ?? null;
    },

    async moveSizeStatsWidened(args) {
      const { data } = await sb
        .from("move_size_stats")
        .select("*")
        .eq("org_id", args.orgId)
        .eq("brand_code", args.brandCode)
        .eq("move_category", args.moveCategory)
        .order("sample_n", { ascending: false })
        .limit(1)
        .maybeSingle();
      return (data as MoveSizeStatRow | null) ?? null;
    },

    async materialPatterns(args) {
      const { data } = await sb
        .from("material_patterns")
        .select("*")
        .eq("org_id", args.orgId)
        .eq("brand_code", args.brandCode)
        .eq("move_category", args.moveCategory);
      return (data ?? []) as MaterialPatternRow[];
    },

    async valuationPatterns(args) {
      const { data } = await sb
        .from("valuation_patterns")
        .select("*")
        .eq("org_id", args.orgId)
        .eq("brand_code", args.brandCode)
        .eq("move_category", args.moveCategory)
        .maybeSingle();
      return (data as ValuationPatternRow | null) ?? null;
    },

    async operationalFee(args) {
      const { data } = await sb
        .from("operational_fee_patterns")
        .select("median")
        .eq("org_id", args.orgId)
        .eq("brand_code", args.brandCode)
        .eq("fee_type", args.feeType)
        .eq("move_class", args.moveClass)
        .maybeSingle();
      return (data as { median: number } | null)?.median ?? null;
    },

    async marginPolicy(args): Promise<MarginPolicy> {
      const { data } = await sb
        .from("margin_policies")
        .select("*")
        .eq("org_id", args.orgId)
        .eq("brand_code", args.brandCode)
        .eq("move_class", args.moveClass)
        .maybeSingle();
      if (data) {
        return {
          move_class: data.move_class as PricingMode,
          min_margin_pct: data.min_margin_pct,
          target_margin_pct: data.target_margin_pct,
        };
      }
      return {
        move_class: args.moveClass,
        min_margin_pct: args.moveClass === "long_distance" ? 43 : 35,
        target_margin_pct: args.moveClass === "long_distance" ? 50 : 45,
      };
    },

    async branchConfig(args): Promise<BranchConfig> {
      const { data } = await sb
        .from("estimator_branch_config")
        .select("*")
        .eq("org_id", args.orgId)
        .eq("brand_code", args.brandCode)
        .maybeSingle();
      if (!data) return DEFAULT_BRANCH_CONFIG;
      // Prefer the split cost columns (migration 0014); fall back to the
      // legacy `burdened_hourly` if the new columns haven't been populated
      // yet. Truck cost defaults conservatively when only legacy exists.
      const burdenedLabor =
        data.burdened_per_worker_hour !== null && data.burdened_per_worker_hour !== undefined
          ? Number(data.burdened_per_worker_hour)
          : Number(data.burdened_hourly ?? DEFAULT_BRANCH_CONFIG.burdened_per_worker_hour);
      const truckCost =
        data.truck_cost_per_hour !== null && data.truck_cost_per_hour !== undefined
          ? Number(data.truck_cost_per_hour)
          : DEFAULT_BRANCH_CONFIG.truck_cost_per_hour;
      // Safe-Number: null/undefined columns fall back to the corresponding
      // DEFAULT_BRANCH_CONFIG value so a partially-populated row never
      // produces NaN downstream.
      const num = (v: unknown, fallback: number): number => {
        if (v === null || v === undefined) return fallback;
        const n = Number(v);
        return Number.isFinite(n) ? n : fallback;
      };
      return {
        rate_base_2man_1truck: num(data.rate_base_2man_1truck, DEFAULT_BRANCH_CONFIG.rate_base_2man_1truck),
        rate_per_extra_man: num(data.rate_per_extra_man, DEFAULT_BRANCH_CONFIG.rate_per_extra_man),
        rate_per_extra_truck: num(data.rate_per_extra_truck, DEFAULT_BRANCH_CONFIG.rate_per_extra_truck),
        burdened_per_worker_hour: burdenedLabor,
        truck_cost_per_hour: truckCost,
        deadhead_cost_per_mile: num(data.deadhead_cost_per_mile, DEFAULT_BRANCH_CONFIG.deadhead_cost_per_mile),
        sales_tax_pct: num(data.sales_tax_pct, DEFAULT_BRANCH_CONFIG.sales_tax_pct),
        default_shuttle_fee: num(data.default_shuttle_fee, DEFAULT_BRANCH_CONFIG.default_shuttle_fee),
        default_long_haul_prep_fee: num(data.default_long_haul_prep_fee, DEFAULT_BRANCH_CONFIG.default_long_haul_prep_fee),
        default_tv_crating_fee: num(data.default_tv_crating_fee, DEFAULT_BRANCH_CONFIG.default_tv_crating_fee),
        default_specialty_fee: num(data.default_specialty_fee, DEFAULT_BRANCH_CONFIG.default_specialty_fee),
        default_fuel_surcharge_pct: num(data.default_fuel_surcharge_pct, DEFAULT_BRANCH_CONFIG.default_fuel_surcharge_pct),
        linehaul_rate_mode:
          (data.linehaul_rate_mode as BranchConfig["linehaul_rate_mode"]) ?? "midpoint",
        linehaul_rate_custom_per_lb:
          data.linehaul_rate_custom_per_lb !== null && data.linehaul_rate_custom_per_lb !== undefined
            ? Number(data.linehaul_rate_custom_per_lb)
            : undefined,
      };
    },

    async nearestShopMiles(args): Promise<number | null> {
      const { data: shops } = await sb
        .from("shops")
        .select("address, brand_code")
        .eq("org_id", args.orgId)
        .eq("is_active", true);
      if (!shops || shops.length === 0) return null;
      // Prefer brand-specific shops when tagged; otherwise fall back to all active.
      const branded = shops.filter(
        (s) => s.brand_code === args.brandCode || s.brand_code === null,
      );
      const targetShops = branded.length > 0 ? branded : shops;
      if (!googleMapsApiKey) return null;
      // One Distance Matrix call with multi-origin (much cheaper than N calls).
      // Cache each pairwise result for 30d.
      const miles = await multiOriginMiles(
        sb,
        googleMapsApiKey,
        targetShops.map((s) => s.address),
        args.originAddress,
      );
      return miles;
    },

    async drivingMiles(args): Promise<number | null> {
      const originKey = normalize(args.origin);
      const destKey = normalize(args.dest);
      const { data: cached } = await sb
        .from("distance_cache")
        .select("miles, fetched_at")
        .eq("origin_key", originKey)
        .eq("dest_key", destKey)
        .maybeSingle();
      if (cached && daysSince(cached.fetched_at) < 30) return Number(cached.miles);

      if (!googleMapsApiKey) return null;
      try {
        const dm = new GoogleDistanceMatrix(googleMapsApiKey);
        const r = await dm.lookup(args.origin, args.dest);
        await sb.from("distance_cache").upsert(
          {
            origin_key: originKey,
            dest_key: destKey,
            miles: r.miles,
            duration_seconds: r.durationSeconds,
            fetched_at: new Date().toISOString(),
          },
          { onConflict: "origin_key,dest_key" },
        );
        return r.miles;
      } catch {
        return null;
      }
    },

    async drivewayFlags(args): Promise<DrivewayFlags> {
      const empty: DrivewayFlags = {
        narrow: false,
        gravel: false,
        low_clearance: false,
        long_walk: false,
      };
      if (!anthropicApiKey || !googleMapsApiKey) return empty;
      try {
        const result = await analyzeDrivewayFromStreetView({
          address: args.address,
          anthropicApiKey,
          googleMapsApiKey,
        });
        return {
          narrow: result.narrow,
          gravel: result.gravel,
          low_clearance: result.low_clearance,
          long_walk: result.long_walk,
        };
      } catch {
        return empty;
      }
    },
  };
}

/**
 * Google Distance Matrix with multiple origins and a single destination in
 * one call. Returns the minimum distance (miles) across origins. Caches each
 * pairwise result in `distance_cache` so the second call in 30 days is free.
 */
async function multiOriginMiles(
  sb: SupabaseClient,
  apiKey: string,
  origins: string[],
  destination: string,
): Promise<number | null> {
  if (origins.length === 0) return null;
  // Check cache first; hit if every origin has a fresh row.
  const cached: Array<{ miles: number; origin: string }> = [];
  const toFetch: string[] = [];
  for (const origin of origins) {
    const { data } = await sb
      .from("distance_cache")
      .select("miles, fetched_at")
      .eq("origin_key", normalize(origin))
      .eq("dest_key", normalize(destination))
      .maybeSingle();
    if (data && daysSince(data.fetched_at) < 30) {
      cached.push({ origin, miles: Number(data.miles) });
    } else {
      toFetch.push(origin);
    }
  }

  if (toFetch.length > 0) {
    const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
    url.searchParams.set("origins", toFetch.join("|"));
    url.searchParams.set("destinations", destination);
    url.searchParams.set("units", "imperial");
    url.searchParams.set("key", apiKey);
    try {
      const res = await fetch(url.toString());
      if (res.ok) {
        const json = (await res.json()) as {
          status: string;
          rows?: { elements: { status: string; distance?: { value: number } }[] }[];
        };
        if (json.status === "OK" && json.rows) {
          for (let i = 0; i < toFetch.length; i++) {
            const el = json.rows[i]?.elements?.[0] as
              | { status: string; distance?: { value: number }; duration?: { value: number } }
              | undefined;
            if (el?.status === "OK" && el.distance) {
              const miles = el.distance.value / 1609.344;
              cached.push({ origin: toFetch[i], miles });
              await sb.from("distance_cache").upsert(
                {
                  origin_key: normalize(toFetch[i]),
                  dest_key: normalize(destination),
                  miles,
                  duration_seconds: el.duration?.value ?? null,
                  fetched_at: new Date().toISOString(),
                },
                { onConflict: "origin_key,dest_key" },
              );
            }
          }
        }
      }
    } catch {
      // fall through — we return what we have cached
    }
  }

  if (cached.length === 0) return null;
  return cached.reduce((min, c) => Math.min(min, c.miles), Number.POSITIVE_INFINITY);
}

function normalize(addr: string): string {
  return addr.toLowerCase().trim().replace(/\s+/g, " ");
}

function daysSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24);
}
