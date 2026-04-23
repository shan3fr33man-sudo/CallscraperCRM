-- 0010 estimator: historical-data-driven auto-estimator.
--
-- Backs the Estimate Creator module. Tables group into four concerns:
--
--   1. Scrape state     : historical_jobs, sm_sync_cursor
--   2. Aggregated stats : move_size_stats, material_patterns,
--                         valuation_patterns, operational_fee_patterns
--   3. Config           : shops, margin_policies, distance_cache
--   4. Predictions log  : estimator_predictions (for backtesting)
--
-- Extends two existing tables: `opportunities` gets `extracted_inventory_json`
-- (cached Claude transcript-to-inventory output); `estimates` gets
-- `auto_generated`, `pricing_mode`, and `estimate_type` constraint widened to
-- allow 'binding'.
--
-- Tenant isolation: every new table has RLS enabled + FORCED + the standard
-- `tenant_isolation` policy using `public.get_my_org_id()` (defined in 0003).
-- Service role bypasses via its own role grants.


-- ─── 1. Scrape state ──────────────────────────────────────────────────

create table if not exists public.historical_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  sm_opportunity_id text not null,
  move_category text not null,          -- '1br' | '2br' | '3br' | 'condo' | 'apartment' | 'townhouse' | 'commercial' | 'single_item'
  pricing_mode text not null default 'local', -- 'local' | 'long_distance'
  origin_zip text,
  dest_zip text,
  origin_state text,
  dest_state text,
  service_date date,
  crew_size int,
  truck_size text,
  billed_hours numeric,
  total_miles numeric,
  total_weight_lb numeric,
  total_cu_ft numeric,
  total_amount numeric,
  linehaul_rate_per_lb numeric,
  fuel_surcharge_pct numeric,
  deadhead_miles numeric,
  shuttle_fee numeric,
  long_haul_prep_fee numeric,
  crating_fees numeric,
  materials_json jsonb default '{}'::jsonb,       -- { tv_boxes: 4, mattress_bags: 2, ... } + unit prices
  inventory_json jsonb default '[]'::jsonb,       -- room-by-room, feeds cu-ft lookup seeding
  valuation_type text,                             -- 'basic' | 'full'
  declared_value numeric,
  access_json jsonb default '{}'::jsonb,           -- { stairs, elevator, long_carry, specialty[] }
  actual_margin_pct numeric,
  raw_payload jsonb not null,                      -- full SM response for replay
  synced_at timestamptz not null default now(),
  unique (org_id, sm_opportunity_id)
);
create index if not exists idx_historical_jobs_lookup
  on public.historical_jobs (org_id, move_category, pricing_mode);
create index if not exists idx_historical_jobs_zip
  on public.historical_jobs (org_id, origin_zip, dest_zip);
create index if not exists idx_historical_jobs_date
  on public.historical_jobs (org_id, service_date desc);

create table if not exists public.sm_sync_cursor (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  move_category text not null,
  last_offset int not null default 0,
  last_sm_opportunity_id text,
  target_count int not null default 1000,
  fetched_count int not null default 0,
  status text not null default 'pending', -- 'pending' | 'running' | 'done' | 'failed'
  last_error text,
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (org_id, move_category)
);


-- ─── 2. Aggregated stats (recomputed by refresh_estimator_stats) ──────

create table if not exists public.move_size_stats (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  move_category text not null,
  pricing_mode text not null,
  distance_bucket text not null,     -- 'local_<25mi' | '25_100mi' | '100_500mi' | '500_1500mi' | '1500_plus_mi'
  season text not null,              -- 'winter' | 'spring' | 'summer' | 'fall' | 'any'
  hours_p25 numeric,
  hours_p50 numeric,
  hours_p75 numeric,
  crew_mode int,
  truck_mode text,
  amount_p25 numeric,
  amount_p50 numeric,
  amount_p75 numeric,
  linehaul_rate_median numeric,
  fuel_surcharge_pct_median numeric,
  weight_per_cuft_median numeric,
  sample_n int not null default 0,
  refreshed_at timestamptz not null default now(),
  unique (org_id, move_category, pricing_mode, distance_bucket, season)
);

create table if not exists public.material_patterns (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  move_category text not null,
  sku text not null,                 -- 'tv_box' | 'mattress_bag' | 'wardrobe_box' | 'packing_paper' | 'tape' | 'dish_pack' | 'picture_box'
  qty_median numeric,
  qty_p75 numeric,
  unit_price_median numeric,
  sample_n int not null default 0,
  refreshed_at timestamptz not null default now(),
  unique (org_id, move_category, sku)
);

create table if not exists public.valuation_patterns (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  move_category text not null,
  pct_basic numeric,
  pct_full numeric,
  avg_declared_value_when_full numeric,
  sample_n int not null default 0,
  refreshed_at timestamptz not null default now(),
  unique (org_id, move_category)
);

create table if not exists public.operational_fee_patterns (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  fee_type text not null,            -- 'deadhead' | 'fuel_surcharge' | 'shuttle' | 'long_haul_prep' | 'tv_crating' | 'specialty'
  move_class text not null,          -- 'local' | 'long_distance'
  median numeric,
  p75 numeric,
  sample_n int not null default 0,
  refreshed_at timestamptz not null default now(),
  unique (org_id, fee_type, move_class)
);


-- ─── 3. Config ────────────────────────────────────────────────────────

create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  address text not null,
  lat numeric,
  lng numeric,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_shops_org_active on public.shops(org_id) where is_active;

create table if not exists public.distance_cache (
  id uuid primary key default gen_random_uuid(),
  origin_key text not null,          -- normalized address or zip
  dest_key text not null,
  miles numeric not null,
  duration_seconds int,
  provider text not null default 'google_distance_matrix',
  fetched_at timestamptz not null default now(),
  unique (origin_key, dest_key)
);
create index if not exists idx_distance_cache_fresh
  on public.distance_cache(fetched_at desc);

create table if not exists public.margin_policies (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  move_class text not null,          -- 'local' | 'long_distance'
  min_margin_pct numeric not null,
  target_margin_pct numeric not null,
  updated_at timestamptz not null default now(),
  unique (org_id, move_class)
);


-- ─── 4. Predictions log ───────────────────────────────────────────────

create table if not exists public.estimator_predictions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  estimate_id uuid references public.estimates(id) on delete set null,
  opportunity_id uuid references public.opportunities(id) on delete cascade,
  pricing_mode text not null,        -- 'local' | 'long_distance'
  inputs_json jsonb not null,        -- snapshot of what we fed into predict()
  prediction_json jsonb not null,    -- full prediction output
  comparable_sample_n int,
  confidence numeric,
  margin_status text,                -- 'ok' | 'warn' | 'block'
  margin_pct numeric,
  driveway_review_required boolean default false,
  driveway_flags jsonb default '{}'::jsonb,  -- { narrow, gravel, low_clearance, long_walk }
  deadhead_skipped boolean default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_estimator_predictions_opp
  on public.estimator_predictions(opportunity_id);
create index if not exists idx_estimator_predictions_est
  on public.estimator_predictions(estimate_id);


-- ─── 5. Extend existing tables ────────────────────────────────────────

-- Cache Claude-extracted inventory on the opportunity so re-runs don't re-bill.
alter table public.opportunities
  add column if not exists extracted_inventory_json jsonb,
  add column if not exists inventory_extracted_at timestamptz,
  add column if not exists inventory_extraction_confidence numeric;

-- Tag auto-generated estimates + remember pricing mode.
alter table public.estimates
  add column if not exists auto_generated boolean not null default false,
  add column if not exists pricing_mode text default 'local';

-- ─── 6. RLS (per 0003 pattern) ────────────────────────────────────────

do $$
declare
  t text;
  new_tables text[] := array[
    'historical_jobs',
    'sm_sync_cursor',
    'move_size_stats',
    'material_patterns',
    'valuation_patterns',
    'operational_fee_patterns',
    'shops',
    'margin_policies',
    'estimator_predictions'
  ];
  pol record;
begin
  foreach t in array new_tables loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    for pol in select policyname from pg_policies where schemaname='public' and tablename=t loop
      execute format('drop policy if exists %I on public.%I', pol.policyname, t);
    end loop;
    execute format(
      'create policy tenant_isolation on public.%I for all to authenticated using (org_id = public.get_my_org_id()) with check (org_id = public.get_my_org_id())',
      t
    );
  end loop;
end $$;

-- distance_cache is the one new table without org_id (cache is global, not
-- tenant-scoped). Service role writes, any authenticated user may read.
alter table public.distance_cache enable row level security;
alter table public.distance_cache force row level security;
drop policy if exists distance_cache_read on public.distance_cache;
create policy distance_cache_read on public.distance_cache
  for select to authenticated using (true);


-- ─── 7. Aggregation function ──────────────────────────────────────────

-- Recomputes move_size_stats, material_patterns, valuation_patterns, and
-- operational_fee_patterns from the raw historical_jobs table. Idempotent.
-- Run this after any sync (one-time or nightly delta).
create or replace function public.refresh_estimator_stats(p_org_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- move_size_stats: one row per (org, category, pricing_mode, distance_bucket, season)
  delete from public.move_size_stats
  where (p_org_id is null or org_id = p_org_id);

  insert into public.move_size_stats
    (org_id, move_category, pricing_mode, distance_bucket, season,
     hours_p25, hours_p50, hours_p75, crew_mode, truck_mode,
     amount_p25, amount_p50, amount_p75,
     linehaul_rate_median, fuel_surcharge_pct_median, weight_per_cuft_median,
     sample_n, refreshed_at)
  select
    h.org_id,
    h.move_category,
    h.pricing_mode,
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
    percentile_cont(0.25) within group (order by h.billed_hours) as hours_p25,
    percentile_cont(0.50) within group (order by h.billed_hours) as hours_p50,
    percentile_cont(0.75) within group (order by h.billed_hours) as hours_p75,
    mode() within group (order by h.crew_size) as crew_mode,
    mode() within group (order by h.truck_size) as truck_mode,
    percentile_cont(0.25) within group (order by h.total_amount) as amount_p25,
    percentile_cont(0.50) within group (order by h.total_amount) as amount_p50,
    percentile_cont(0.75) within group (order by h.total_amount) as amount_p75,
    percentile_cont(0.50) within group (order by h.linehaul_rate_per_lb) as linehaul_rate_median,
    percentile_cont(0.50) within group (order by h.fuel_surcharge_pct) as fuel_surcharge_pct_median,
    percentile_cont(0.50) within group (
      order by case when h.total_cu_ft > 0 then h.total_weight_lb / h.total_cu_ft end
    ) as weight_per_cuft_median,
    count(*) as sample_n,
    now() as refreshed_at
  from public.historical_jobs h
  where (p_org_id is null or h.org_id = p_org_id)
  group by h.org_id, h.move_category, h.pricing_mode, distance_bucket, season;

  -- material_patterns: one row per (org, category, sku).
  -- materials_json shape: { "tv_box": { "qty": 4, "unit_price": 12.50 }, ... }
  delete from public.material_patterns
  where (p_org_id is null or org_id = p_org_id);

  insert into public.material_patterns
    (org_id, move_category, sku, qty_median, qty_p75, unit_price_median, sample_n, refreshed_at)
  select
    h.org_id,
    h.move_category,
    kv.key as sku,
    percentile_cont(0.50) within group (order by (kv.value->>'qty')::numeric) as qty_median,
    percentile_cont(0.75) within group (order by (kv.value->>'qty')::numeric) as qty_p75,
    percentile_cont(0.50) within group (order by (kv.value->>'unit_price')::numeric) as unit_price_median,
    count(*) as sample_n,
    now() as refreshed_at
  from public.historical_jobs h,
       lateral jsonb_each(coalesce(h.materials_json, '{}'::jsonb)) kv
  where (p_org_id is null or h.org_id = p_org_id)
    and jsonb_typeof(kv.value) = 'object'
  group by h.org_id, h.move_category, kv.key;

  -- valuation_patterns: one row per (org, category).
  delete from public.valuation_patterns
  where (p_org_id is null or org_id = p_org_id);

  insert into public.valuation_patterns
    (org_id, move_category, pct_basic, pct_full, avg_declared_value_when_full, sample_n, refreshed_at)
  select
    h.org_id,
    h.move_category,
    avg(case when h.valuation_type = 'basic' then 1.0 else 0.0 end) as pct_basic,
    avg(case when h.valuation_type = 'full'  then 1.0 else 0.0 end) as pct_full,
    avg(h.declared_value) filter (where h.valuation_type = 'full') as avg_declared_value_when_full,
    count(*) filter (where h.valuation_type is not null) as sample_n,
    now() as refreshed_at
  from public.historical_jobs h
  where (p_org_id is null or h.org_id = p_org_id)
  group by h.org_id, h.move_category;

  -- operational_fee_patterns: one row per (org, fee_type, move_class).
  delete from public.operational_fee_patterns
  where (p_org_id is null or org_id = p_org_id);

  insert into public.operational_fee_patterns
    (org_id, fee_type, move_class, median, p75, sample_n, refreshed_at)
  select org_id, fee_type, move_class,
         percentile_cont(0.50) within group (order by fee) as median,
         percentile_cont(0.75) within group (order by fee) as p75,
         count(*) as sample_n,
         now() as refreshed_at
  from (
    select org_id, pricing_mode as move_class, 'shuttle' as fee_type, shuttle_fee as fee
      from public.historical_jobs where shuttle_fee is not null
    union all
    select org_id, pricing_mode, 'long_haul_prep', long_haul_prep_fee
      from public.historical_jobs where long_haul_prep_fee is not null
    union all
    select org_id, pricing_mode, 'crating', crating_fees
      from public.historical_jobs where crating_fees is not null
    union all
    select org_id, pricing_mode, 'fuel_surcharge', fuel_surcharge_pct
      from public.historical_jobs where fuel_surcharge_pct is not null
    union all
    select org_id, pricing_mode, 'deadhead', deadhead_miles
      from public.historical_jobs where deadhead_miles is not null
  ) fees
  where (p_org_id is null or org_id = p_org_id)
  group by org_id, fee_type, move_class;

  -- Seed default margin policies if none exist for the org(s). 43/50 for
  -- long-distance, 35/45 for local (from Pamela Bartlett example).
  insert into public.margin_policies (org_id, move_class, min_margin_pct, target_margin_pct)
  select o.id, 'local', 35, 45
  from public.organizations o
  where (p_org_id is null or o.id = p_org_id)
    and not exists (
      select 1 from public.margin_policies mp
      where mp.org_id = o.id and mp.move_class = 'local'
    );

  insert into public.margin_policies (org_id, move_class, min_margin_pct, target_margin_pct)
  select o.id, 'long_distance', 43, 50
  from public.organizations o
  where (p_org_id is null or o.id = p_org_id)
    and not exists (
      select 1 from public.margin_policies mp
      where mp.org_id = o.id and mp.move_class = 'long_distance'
    );
end;
$$;

revoke all on function public.refresh_estimator_stats(uuid) from public;
grant execute on function public.refresh_estimator_stats(uuid) to authenticated, service_role;

comment on function public.refresh_estimator_stats(uuid) is
  'Recomputes move_size_stats/material_patterns/valuation_patterns/operational_fee_patterns from historical_jobs. Pass NULL for all orgs or a specific org_id to scope.';
