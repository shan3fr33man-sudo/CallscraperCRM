-- 0013 brand_scoping: per-brand estimator (APM/AFM/crewready/apex) + config.
--
-- Background: the codebase has ONE `organizations` row (default) and FOUR
-- `branches` rows differentiated by brand_code. CallScraper's `calls.brand`
-- maps to `branches.brand_code`, not `organizations.slug`. Migrations 0010-
-- 0012 scoped estimator tables on org_id alone, which would pool all four
-- brands into one statistical bucket. This migration adds brand_code to
-- every estimator table, rewrites the aggregation function to group by it,
-- and introduces a per-brand config table so hardcoded constants move out
-- of the estimator package.
--
-- Also repairs: (1) AFM branch display name (stale seed said "A Friend with
-- a Truck"; correct name per operator is "Affordable Movers LLC");
-- (2) estimates.estimate_type CHECK constraint; (3) idempotency unique
-- index on opportunities (supersedes the non-unique index in 0012).

-- ─── 1. Patch AFM branch name ─────────────────────────────────────────

update public.branches set name = 'Affordable Movers LLC'
where brand_code = 'AFM' and name = 'A Friend with a Truck';

-- ─── 2. Add brand_code to estimator tables ────────────────────────────

alter table public.historical_jobs
  add column if not exists brand_code text not null default 'APM';
alter table public.sm_sync_cursor
  add column if not exists brand_code text not null default 'APM';
alter table public.move_size_stats
  add column if not exists brand_code text not null default 'APM';
alter table public.material_patterns
  add column if not exists brand_code text not null default 'APM';
alter table public.valuation_patterns
  add column if not exists brand_code text not null default 'APM';
alter table public.operational_fee_patterns
  add column if not exists brand_code text not null default 'APM';
alter table public.shops
  add column if not exists brand_code text;
alter table public.margin_policies
  add column if not exists brand_code text not null default 'APM';
alter table public.estimator_predictions
  add column if not exists brand_code text not null default 'APM';
alter table public.opportunities
  add column if not exists brand_code text;

-- Drop uniques from 0010 that ignored brand_code, recreate with it.
--
-- Postgres auto-generates constraint names from table + columns + "_key" and
-- truncates to NAMEDATALEN-1 (63 chars) with non-trivial rules. Rather than
-- guess the truncated name, we look up each table's UNIQUE constraints via
-- information_schema and drop all of them; our new column-list indexes
-- supersede anything that was there.
do $$
declare
  t text;
  c text;
  targets text[] := array[
    'historical_jobs',
    'sm_sync_cursor',
    'move_size_stats',
    'material_patterns',
    'valuation_patterns',
    'operational_fee_patterns',
    'margin_policies'
  ];
begin
  foreach t in array targets loop
    for c in
      select constraint_name
      from information_schema.table_constraints
      where table_schema = 'public'
        and table_name = t
        and constraint_type = 'UNIQUE'
    loop
      execute format('alter table public.%I drop constraint %I', t, c);
    end loop;
  end loop;
end $$;

create unique index if not exists uq_historical_jobs_org_brand_sm
  on public.historical_jobs (org_id, brand_code, sm_opportunity_id);
create unique index if not exists uq_sm_sync_cursor_org_brand_cat
  on public.sm_sync_cursor (org_id, brand_code, move_category);
create unique index if not exists uq_move_size_stats_full
  on public.move_size_stats (org_id, brand_code, move_category, pricing_mode, distance_bucket, season);
create unique index if not exists uq_material_patterns_full
  on public.material_patterns (org_id, brand_code, move_category, sku);
create unique index if not exists uq_valuation_patterns_full
  on public.valuation_patterns (org_id, brand_code, move_category);
create unique index if not exists uq_operational_fee_patterns_full
  on public.operational_fee_patterns (org_id, brand_code, fee_type, move_class);
create unique index if not exists uq_margin_policies_full
  on public.margin_policies (org_id, brand_code, move_class);

-- estimator_predictions source_call_id uniqueness now scoped by brand_code.
drop index if exists uq_estimator_predictions_source_call_id;
create unique index if not exists uq_estimator_predictions_source_call_id
  on public.estimator_predictions (org_id, brand_code, source_call_id)
  where source_call_id is not null;

-- opportunities: proper unique index for idempotent upsert keyed on the call.
drop index if exists idx_opportunities_source_call_id;
create unique index if not exists uq_opportunities_source_call_id
  on public.opportunities (org_id, brand_code, source_call_id)
  where source_call_id is not null;

-- estimates: constrain estimate_type to the two legal values.
alter table public.estimates drop constraint if exists estimates_estimate_type_chk;
alter table public.estimates
  add constraint estimates_estimate_type_chk
  check (estimate_type in ('non_binding', 'binding'));

-- ─── 3. Per-brand config ──────────────────────────────────────────────

create table if not exists public.estimator_branch_config (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  brand_code text not null,
  burdened_hourly numeric not null default 30,
  deadhead_cost_per_mile numeric not null default 3.5,
  default_shuttle_fee numeric not null default 900,
  default_long_haul_prep_fee numeric not null default 300,
  default_tv_crating_fee numeric not null default 150,
  default_specialty_fee numeric not null default 250,
  default_fuel_surcharge_pct numeric not null default 0.12,
  linehaul_rate_mode text not null default 'midpoint', -- 'min' | 'midpoint' | 'max' | 'custom'
  linehaul_rate_custom_per_lb numeric,
  is_placeholder boolean not null default true,
  notes text,
  updated_at timestamptz not null default now(),
  unique (org_id, brand_code)
);

alter table public.estimator_branch_config enable row level security;
alter table public.estimator_branch_config force row level security;
drop policy if exists tenant_isolation on public.estimator_branch_config;
create policy tenant_isolation on public.estimator_branch_config
  for all to authenticated
  using (org_id = public.get_my_org_id())
  with check (org_id = public.get_my_org_id());

-- Seed per-brand placeholders. Operator provided rough per-brand labor
-- rates; everything else uses defensible industry defaults. Flagged as
-- is_placeholder=true so the settings UI can show a "tune me" banner.
insert into public.estimator_branch_config
  (org_id, brand_code, burdened_hourly, notes)
select o.id, 'APM', 42, 'PLACEHOLDER: update via /settings/estimator'
from public.organizations o
where not exists (
  select 1 from public.estimator_branch_config c
  where c.org_id = o.id and c.brand_code = 'APM'
);

insert into public.estimator_branch_config
  (org_id, brand_code, burdened_hourly, notes)
select o.id, 'AFM', 35, 'PLACEHOLDER: update via /settings/estimator'
from public.organizations o
where not exists (
  select 1 from public.estimator_branch_config c
  where c.org_id = o.id and c.brand_code = 'AFM'
);

-- ─── 4. Rewrite aggregation function with brand_code grouping ─────────

-- Drop both possible prior signatures so the new function compiles cleanly
-- and there's no overload ambiguity. NOTE: do NOT default p_org_id; doing so
-- creates a 1-arg call signature that collides with any wrapper overload and
-- raises 42725 at runtime. Live discovery 2026-04-22.
drop function if exists public.refresh_estimator_stats(uuid);
drop function if exists public.refresh_estimator_stats(uuid, text);

create or replace function public.refresh_estimator_stats(
  p_org_id uuid,
  p_brand_code text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.move_size_stats
  where (p_org_id is null or org_id = p_org_id)
    and (p_brand_code is null or brand_code = p_brand_code);

  insert into public.move_size_stats
    (org_id, brand_code, move_category, pricing_mode, distance_bucket, season,
     hours_p25, hours_p50, hours_p75, crew_mode, truck_mode,
     amount_p25, amount_p50, amount_p75,
     linehaul_rate_median, fuel_surcharge_pct_median, weight_per_cuft_median,
     sample_n, refreshed_at)
  select
    h.org_id, h.brand_code, h.move_category, h.pricing_mode,
    case
      when h.total_miles is null then 'unknown'
      when h.total_miles < 25 then 'local_under_25mi'
      when h.total_miles < 100 then '25_100mi'
      when h.total_miles < 500 then '100_500mi'
      when h.total_miles < 1500 then '500_1500mi'
      else '1500_plus_mi'
    end as distance_bucket,
    case extract(month from h.service_date)
      when 12 then 'winter' when 1 then 'winter' when 2 then 'winter'
      when 3 then 'spring' when 4 then 'spring' when 5 then 'spring'
      when 6 then 'summer' when 7 then 'summer' when 8 then 'summer'
      else 'fall'
    end as season,
    percentile_cont(0.25) within group (order by h.billed_hours),
    percentile_cont(0.50) within group (order by h.billed_hours),
    percentile_cont(0.75) within group (order by h.billed_hours),
    mode() within group (order by h.crew_size),
    mode() within group (order by h.truck_size),
    percentile_cont(0.25) within group (order by h.total_amount),
    percentile_cont(0.50) within group (order by h.total_amount),
    percentile_cont(0.75) within group (order by h.total_amount),
    percentile_cont(0.50) within group (order by h.linehaul_rate_per_lb),
    percentile_cont(0.50) within group (order by h.fuel_surcharge_pct),
    percentile_cont(0.50) within group (
      order by case when h.total_cu_ft > 0 then h.total_weight_lb / h.total_cu_ft end
    ),
    count(*), now()
  from public.historical_jobs h
  where (p_org_id is null or h.org_id = p_org_id)
    and (p_brand_code is null or h.brand_code = p_brand_code)
  group by h.org_id, h.brand_code, h.move_category, h.pricing_mode, distance_bucket, season;

  delete from public.material_patterns
  where (p_org_id is null or org_id = p_org_id)
    and (p_brand_code is null or brand_code = p_brand_code);

  insert into public.material_patterns
    (org_id, brand_code, move_category, sku, qty_median, qty_p75, unit_price_median, sample_n, refreshed_at)
  select
    h.org_id, h.brand_code, h.move_category, kv.key,
    percentile_cont(0.50) within group (order by (kv.value->>'qty')::numeric),
    percentile_cont(0.75) within group (order by (kv.value->>'qty')::numeric),
    percentile_cont(0.50) within group (order by (kv.value->>'unit_price')::numeric),
    count(*), now()
  from public.historical_jobs h,
       lateral jsonb_each(coalesce(h.materials_json, '{}'::jsonb)) kv
  where (p_org_id is null or h.org_id = p_org_id)
    and (p_brand_code is null or h.brand_code = p_brand_code)
    and jsonb_typeof(kv.value) = 'object'
  group by h.org_id, h.brand_code, h.move_category, kv.key;

  delete from public.valuation_patterns
  where (p_org_id is null or org_id = p_org_id)
    and (p_brand_code is null or brand_code = p_brand_code);

  insert into public.valuation_patterns
    (org_id, brand_code, move_category, pct_basic, pct_full, avg_declared_value_when_full, sample_n, refreshed_at)
  select
    h.org_id, h.brand_code, h.move_category,
    avg(case when h.valuation_type = 'basic' then 1.0 else 0.0 end),
    avg(case when h.valuation_type = 'full'  then 1.0 else 0.0 end),
    avg(h.declared_value) filter (where h.valuation_type = 'full'),
    count(*) filter (where h.valuation_type is not null), now()
  from public.historical_jobs h
  where (p_org_id is null or h.org_id = p_org_id)
    and (p_brand_code is null or h.brand_code = p_brand_code)
  group by h.org_id, h.brand_code, h.move_category;

  delete from public.operational_fee_patterns
  where (p_org_id is null or org_id = p_org_id)
    and (p_brand_code is null or brand_code = p_brand_code);

  insert into public.operational_fee_patterns
    (org_id, brand_code, fee_type, move_class, median, p75, sample_n, refreshed_at)
  select org_id, brand_code, fee_type, move_class,
         percentile_cont(0.50) within group (order by fee),
         percentile_cont(0.75) within group (order by fee),
         count(*), now()
  from (
    select org_id, brand_code, pricing_mode as move_class, 'shuttle' as fee_type, shuttle_fee as fee
      from public.historical_jobs where shuttle_fee is not null
    union all
    select org_id, brand_code, pricing_mode, 'long_haul_prep', long_haul_prep_fee
      from public.historical_jobs where long_haul_prep_fee is not null
    union all
    select org_id, brand_code, pricing_mode, 'crating', crating_fees
      from public.historical_jobs where crating_fees is not null
    union all
    select org_id, brand_code, pricing_mode, 'fuel_surcharge', fuel_surcharge_pct
      from public.historical_jobs where fuel_surcharge_pct is not null
    union all
    select org_id, brand_code, pricing_mode, 'deadhead', deadhead_miles
      from public.historical_jobs where deadhead_miles is not null
  ) fees
  where (p_org_id is null or org_id = p_org_id)
    and (p_brand_code is null or brand_code = p_brand_code)
  group by org_id, brand_code, fee_type, move_class;

  -- Margin policies default seed (keyed on brand_code now).
  insert into public.margin_policies (org_id, brand_code, move_class, min_margin_pct, target_margin_pct)
  select o.id, bc.brand_code, 'local', 35, 45
  from public.organizations o
  cross join (values ('APM'),('AFM'),('apex'),('crewready')) bc(brand_code)
  where (p_org_id is null or o.id = p_org_id)
    and (p_brand_code is null or bc.brand_code = p_brand_code)
    and not exists (
      select 1 from public.margin_policies mp
      where mp.org_id = o.id and mp.brand_code = bc.brand_code and mp.move_class = 'local'
    );

  insert into public.margin_policies (org_id, brand_code, move_class, min_margin_pct, target_margin_pct)
  select o.id, bc.brand_code, 'long_distance', 43, 50
  from public.organizations o
  cross join (values ('APM'),('AFM'),('apex'),('crewready')) bc(brand_code)
  where (p_org_id is null or o.id = p_org_id)
    and (p_brand_code is null or bc.brand_code = p_brand_code)
    and not exists (
      select 1 from public.margin_policies mp
      where mp.org_id = o.id and mp.brand_code = bc.brand_code and mp.move_class = 'long_distance'
    );
end;
$$;

revoke all on function public.refresh_estimator_stats(uuid, text) from public;
grant execute on function public.refresh_estimator_stats(uuid, text) to authenticated, service_role;

comment on function public.refresh_estimator_stats(uuid, text) is
  'Recomputes estimator analytics keyed on (org, brand_code). Pass NULL for p_brand_code to refresh all brands. p_org_id is required.';

-- The 2-arg form with `p_brand_code default null` ALSO satisfies the
-- single-uuid call site `refresh_estimator_stats(<uuid>)`, so no separate
-- 1-arg wrapper is needed. Adding one would create overload ambiguity
-- (Postgres 42725) — both signatures match a single-uuid call. Lesson
-- learned in branch tocjzmjhgdlazbmiehat on 2026-04-22.
