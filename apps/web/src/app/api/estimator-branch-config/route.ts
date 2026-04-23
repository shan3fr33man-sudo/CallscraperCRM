import { NextResponse } from "next/server";
import { crmClient } from "@/lib/crmdb";
import { getOrgId } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * GET /api/estimator-branch-config
 *   → list all per-brand estimator configs for the current org
 *     plus the branch display names for each brand_code.
 *
 * PATCH /api/estimator-branch-config
 *   body: { brand_code, ...fields }
 *   → update a single brand's config. Only whitelisted fields are writable.
 */

const WRITABLE_FIELDS = [
  "rate_base_2man_1truck",
  "rate_per_extra_man",
  "rate_per_extra_truck",
  "burdened_per_worker_hour",
  "truck_cost_per_hour",
  "deadhead_cost_per_mile",
  "sales_tax_pct",
  "default_shuttle_fee",
  "default_long_haul_prep_fee",
  "default_tv_crating_fee",
  "default_specialty_fee",
  "default_fuel_surcharge_pct",
  "linehaul_rate_mode",
  "linehaul_rate_custom_per_lb",
  "wage_average_per_hour",
  "notes",
] as const;

export async function GET() {
  const sb = crmClient();
  const orgId = await getOrgId();

  // Configs joined with branch display names for nicer UI labels.
  const [configs, branches] = await Promise.all([
    sb.from("estimator_branch_config").select("*").eq("org_id", orgId).order("brand_code"),
    sb.from("branches").select("brand_code, name, is_default").eq("org_id", orgId),
  ]);
  if (configs.error) return NextResponse.json({ error: configs.error.message }, { status: 500 });

  const branchMap = new Map(
    (branches.data ?? []).map((b) => [b.brand_code as string, b.name as string]),
  );
  const enriched = (configs.data ?? []).map((c) => ({
    ...c,
    brand_display_name: branchMap.get(c.brand_code) ?? c.brand_code,
  }));

  return NextResponse.json({ configs: enriched });
}

export async function PATCH(req: Request) {
  const body = (await req.json()) as Record<string, unknown>;
  const brand_code = body.brand_code as string | undefined;
  if (!brand_code) {
    return NextResponse.json({ error: "brand_code required" }, { status: 400 });
  }
  const sb = crmClient();
  const orgId = await getOrgId();

  // Fields where a negative value would corrupt downstream math (rates,
  // costs, fees). `sales_tax_pct` / `default_fuel_surcharge_pct` may be 0.
  const NON_NEGATIVE_FIELDS = new Set([
    "rate_base_2man_1truck",
    "rate_per_extra_man",
    "rate_per_extra_truck",
    "burdened_per_worker_hour",
    "truck_cost_per_hour",
    "deadhead_cost_per_mile",
    "sales_tax_pct",
    "default_shuttle_fee",
    "default_long_haul_prep_fee",
    "default_tv_crating_fee",
    "default_specialty_fee",
    "default_fuel_surcharge_pct",
    "linehaul_rate_custom_per_lb",
    "wage_average_per_hour",
  ]);

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    is_placeholder: false,
  };
  for (const key of WRITABLE_FIELDS) {
    if (!(key in body)) continue;
    const raw = body[key];
    let value: unknown = raw;
    if (
      typeof raw === "string" &&
      raw !== "" &&
      /^-?\d+(?:\.\d+)?$/.test(raw.trim())
    ) {
      value = Number(raw);
    }
    if (typeof value === "number") {
      if (!Number.isFinite(value)) {
        return NextResponse.json(
          { error: `${key} must be a finite number` },
          { status: 400 },
        );
      }
      if (NON_NEGATIVE_FIELDS.has(key) && value < 0) {
        return NextResponse.json(
          { error: `${key} must be \u2265 0 (got ${value})` },
          { status: 400 },
        );
      }
    }
    patch[key] = value;
  }

  const { data, error } = await sb
    .from("estimator_branch_config")
    .update(patch)
    .eq("org_id", orgId)
    .eq("brand_code", brand_code)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ config: data });
}
