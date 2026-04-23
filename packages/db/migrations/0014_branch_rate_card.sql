-- 0014 branch_rate_card: split burdened_hourly into labor + truck cost, add
-- customer-facing rate card, seed both brands with researched WA/Snohomish
-- County numbers (2026-04-22 live scrape: mover wage stats, WA L&I class 6907,
-- SUTA, PFML, user-confirmed actual APM wage + truck insurance).
--
-- Revenue-side fields (new):
--   rate_base_2man_1truck     customer $/hr for a 2-man + 1-truck crew
--   rate_per_extra_man        $/hr added per extra mover
--   rate_per_extra_truck      $/hr added per extra truck
--
-- Cost-side split (new):
--   burdened_per_worker_hour  wage + payroll tax + L&I + liability + PTO accrual,
--                             NOT including truck (superset of old burdened_hourly,
--                             but labor-only)
--   truck_cost_per_hour       fuel amortized + depreciation + insurance + maint
--
-- Legacy `burdened_hourly` column is kept for backward compatibility with any
-- code still reading it; predict.ts will switch to the split fields. Drop in
-- a future migration once nothing references it.
--
-- Seeds (researched; see plan ADDENDUM 8):
--   APM: $28 avg wage (operator-confirmed) → $35/hr burdened labor, $16/hr truck
--        rate card: $199 base + $50/man + $50/truck
--   AFM: $25 avg wage (Snohomish County market avg) → $31/hr burdened, $16/hr truck
--        rate card: $189 base + $50/man + $50/truck

alter table public.estimator_branch_config
  add column if not exists rate_base_2man_1truck numeric,
  add column if not exists rate_per_extra_man numeric,
  add column if not exists rate_per_extra_truck numeric,
  add column if not exists burdened_per_worker_hour numeric,
  add column if not exists truck_cost_per_hour numeric,
  add column if not exists sales_tax_pct numeric not null default 0.09,
  add column if not exists wage_average_per_hour numeric;

-- Seed APM + AFM with real numbers. Upsert so fresh installs (where 0013's
-- conditional seed didn't produce APM/AFM rows) get properly populated.
insert into public.estimator_branch_config
  (org_id, brand_code,
   rate_base_2man_1truck, rate_per_extra_man, rate_per_extra_truck,
   burdened_per_worker_hour, truck_cost_per_hour,
   deadhead_cost_per_mile, default_fuel_surcharge_pct,
   wage_average_per_hour, burdened_hourly,
   is_placeholder, notes)
select o.id, 'APM',
       199, 50, 50,
       35, 16,
       3.00, 0.12,
       28, 35,
       false,
       'Seeded 2026-04-22 from operator payroll data + WA L&I class 6907 + Snohomish County market. Update via /settings/estimator as actuals refine.'
from public.organizations o
on conflict (org_id, brand_code) do update set
  rate_base_2man_1truck = excluded.rate_base_2man_1truck,
  rate_per_extra_man = excluded.rate_per_extra_man,
  rate_per_extra_truck = excluded.rate_per_extra_truck,
  burdened_per_worker_hour = excluded.burdened_per_worker_hour,
  truck_cost_per_hour = excluded.truck_cost_per_hour,
  deadhead_cost_per_mile = excluded.deadhead_cost_per_mile,
  default_fuel_surcharge_pct = excluded.default_fuel_surcharge_pct,
  wage_average_per_hour = excluded.wage_average_per_hour,
  is_placeholder = false,
  notes = excluded.notes,
  updated_at = now();

insert into public.estimator_branch_config
  (org_id, brand_code,
   rate_base_2man_1truck, rate_per_extra_man, rate_per_extra_truck,
   burdened_per_worker_hour, truck_cost_per_hour,
   deadhead_cost_per_mile, default_fuel_surcharge_pct,
   wage_average_per_hour, burdened_hourly,
   is_placeholder, notes)
select o.id, 'AFM',
       189, 50, 50,
       31, 16,
       2.75, 0.12,
       25, 31,
       true,
       'Seeded 2026-04-22 with Snohomish County market-average wage ($25/hr). Operator should confirm actual AFM wage average and refresh.'
from public.organizations o
on conflict (org_id, brand_code) do update set
  rate_base_2man_1truck = excluded.rate_base_2man_1truck,
  rate_per_extra_man = excluded.rate_per_extra_man,
  rate_per_extra_truck = excluded.rate_per_extra_truck,
  burdened_per_worker_hour = excluded.burdened_per_worker_hour,
  truck_cost_per_hour = excluded.truck_cost_per_hour,
  deadhead_cost_per_mile = excluded.deadhead_cost_per_mile,
  default_fuel_surcharge_pct = excluded.default_fuel_surcharge_pct,
  wage_average_per_hour = excluded.wage_average_per_hour,
  updated_at = now();

-- Seed new rows for other brand_codes (crewready / apex) if they don't exist,
-- using APM-equivalent defaults. Operator can tune or delete via UI.
insert into public.estimator_branch_config
  (org_id, brand_code, rate_base_2man_1truck, rate_per_extra_man, rate_per_extra_truck,
   burdened_per_worker_hour, truck_cost_per_hour, deadhead_cost_per_mile,
   default_fuel_surcharge_pct, wage_average_per_hour,
   burdened_hourly,  -- legacy
   is_placeholder, notes)
select o.id, bc.brand_code, 199, 50, 50, 35, 16, 3.00, 0.12, 28, 35, true,
       'PLACEHOLDER — seeded from APM defaults; tune via /settings/estimator.'
from public.organizations o
cross join (values ('crewready'), ('apex')) bc(brand_code)
where not exists (
  select 1 from public.estimator_branch_config c
  where c.org_id = o.id and c.brand_code = bc.brand_code
);

-- Keep legacy burdened_hourly in sync so anything still reading it returns the
-- labor component (not labor+truck). Gradual migration pattern.
update public.estimator_branch_config
set burdened_hourly = burdened_per_worker_hour
where burdened_per_worker_hour is not null;

comment on column public.estimator_branch_config.rate_base_2man_1truck is
  'Customer-facing hourly rate for a 2-man crew + 1 truck. Revenue side.';
comment on column public.estimator_branch_config.rate_per_extra_man is
  '$/hr added per mover beyond 2. Revenue side.';
comment on column public.estimator_branch_config.rate_per_extra_truck is
  '$/hr added per truck beyond 1. Revenue side.';
comment on column public.estimator_branch_config.burdened_per_worker_hour is
  'Fully burdened LABOR cost per worker per hour (wage + taxes + L&I + liability + PTO). Excludes truck.';
comment on column public.estimator_branch_config.truck_cost_per_hour is
  'Per-truck per-hour operational cost (fuel amortized + depreciation + insurance + maint + registration). Local moves.';
comment on column public.estimator_branch_config.sales_tax_pct is
  'Sales tax applied to materials (not transportation). WA default 9%.';
comment on column public.estimator_branch_config.wage_average_per_hour is
  'Documented for audit: the blended crew wage the burdened rate was derived from. Informational.';
