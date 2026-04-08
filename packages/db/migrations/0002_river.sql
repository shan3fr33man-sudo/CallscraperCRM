-- 0002_river.sql — vertical CRM tables + event bus + automation engine.
-- All column names locked to upstream callscraper.com vocabulary.

-- ─── Branches (CRM-side, joined to upstream brand text) ───────────────
create table branches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  brand_code text not null, -- joins calls.brand
  address text,
  phone text,
  is_default boolean default false,
  created_at timestamptz default now(),
  unique (org_id, brand_code)
);

-- ─── Customers ────────────────────────────────────────────────────────
create table customers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  upstream_id uuid,             -- callscraper leads.id or sm_customers.id
  sm_id text,                   -- ServiceMonster legacy id
  customer_name text,
  customer_phone text,
  customer_email text,
  display_name text,
  brand text,
  status text,                  -- new | active | inactive | archived
  source text,
  balance numeric default 0,
  latest_assigned_to uuid,
  total_calls int default 0,
  first_seen timestamptz,
  last_seen timestamptz,
  address_json jsonb,
  tags text[] default '{}',
  raw_data jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (org_id, upstream_id)
);
create index customers_phone_idx on customers(org_id, customer_phone);
create index customers_brand_idx on customers(org_id, brand);

-- ─── Opportunities ────────────────────────────────────────────────────
create table opportunities (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  customer_id uuid references customers(id) on delete cascade,
  upstream_id uuid,
  sm_id text,
  quote_number text,
  status text not null default 'new',
  service_type text,
  service_date text,
  move_type text,
  move_size text,
  branch_id uuid references branches(id),
  brand text,
  opportunity_type text,
  source text,
  assigned_to uuid,
  origin_json jsonb,
  destination_json jsonb,
  amount numeric default 0,
  lead_quality text,
  intent text,
  sentiment text,
  age_days int default 0,
  last_activity_at timestamptz,
  sm_url text,
  raw_data jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index opps_status_idx on opportunities(org_id, status);
create index opps_customer_idx on opportunities(customer_id);

-- ─── Estimates ────────────────────────────────────────────────────────
create table estimates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  tariff_id uuid,
  charges_json jsonb default '[]'::jsonb,
  subtotal numeric default 0,
  discounts numeric default 0,
  sales_tax numeric default 0,
  amount numeric default 0,
  valid_until date,
  sent_at timestamptz,
  accepted_at timestamptz,
  declined_at timestamptz,
  pdf_url text,
  tariff_snapshot jsonb,
  created_at timestamptz default now()
);

-- ─── Jobs ─────────────────────────────────────────────────────────────
create table jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  opportunity_id uuid references opportunities(id) on delete cascade,
  customer_id uuid references customers(id),
  quote_number text,
  customer_name text,
  service_type text,
  service_date date,
  status text not null default 'booked',
  billed numeric default 0,
  amount numeric default 0,
  crew_size int,
  truck_ids uuid[] default '{}',
  branch_id uuid references branches(id),
  arrival_window text,
  created_at timestamptz default now()
);
create index jobs_status_idx on jobs(org_id, status);
create index jobs_date_idx on jobs(org_id, service_date);

-- ─── Calendar events ──────────────────────────────────────────────────
create table calendar_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  kind text not null check (kind in ('office','job')),
  event_type text,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean default false,
  owner_id uuid,
  branch_id uuid references branches(id),
  related_type text,
  related_id uuid,
  color text,
  location text,
  created_at timestamptz default now()
);
create index cal_kind_idx on calendar_events(org_id, kind, starts_at);

-- ─── Tasks ────────────────────────────────────────────────────────────
create table tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  title text not null,
  body text,
  due_at timestamptz,
  status text not null default 'not_started',
  assigned_to uuid,
  type text,
  priority int default 3,
  related_type text,
  related_id uuid,
  created_at timestamptz default now()
);
create index tasks_status_idx on tasks(org_id, status, due_at);

-- ─── Tickets / Claims ─────────────────────────────────────────────────
create table tickets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  customer_id uuid references customers(id),
  job_id uuid references jobs(id),
  ticket_name text not null,
  type text,
  status text not null default 'active',
  priority int default 3,
  opened_at timestamptz default now(),
  last_activity_at timestamptz default now(),
  follow_up_at timestamptz,
  assigned_to uuid
);

create table claims (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  customer_id uuid references customers(id),
  job_id uuid references jobs(id),
  status text default 'open',
  amount numeric default 0,
  opened_at timestamptz default now()
);

-- ─── Messages (sms_logs mirrors upstream column shape) ────────────────
create table sms_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  customer_id uuid references customers(id),
  call_id uuid,
  brand text,
  to_number text,
  from_number text,
  message text,
  status text,
  template_key text,
  related_type text,
  related_id uuid,
  sent_at timestamptz default now()
);

create table email_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  customer_id uuid references customers(id),
  to_email text,
  from_email text,
  subject text,
  body text,
  status text,
  template_key text,
  related_type text,
  related_id uuid,
  sent_at timestamptz default now()
);

-- ─── Templates ────────────────────────────────────────────────────────
create table templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  key text not null,
  channel text not null check (channel in ('sms','email')),
  category text,
  subject text,
  body text not null,
  variables text[] default '{}',
  created_at timestamptz default now(),
  unique (org_id, key)
);

-- ─── Event bus + Automations ──────────────────────────────────────────
create table events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  type text not null,
  payload jsonb default '{}'::jsonb,
  related_type text,
  related_id uuid,
  created_at timestamptz default now(),
  processed_at timestamptz
);
create index events_unprocessed_idx on events(org_id, processed_at) where processed_at is null;

create table automations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  trigger text not null,
  conditions_json jsonb default '{}'::jsonb,
  actions_json jsonb default '[]'::jsonb,
  enabled boolean default false,
  created_at timestamptz default now()
);

create table automation_runs (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid not null references automations(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  status text not null,
  started_at timestamptz default now(),
  finished_at timestamptz,
  error text,
  unique (automation_id, event_id)
);

-- ─── Notifications + Profiles + Resources ─────────────────────────────
create table notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  user_id uuid,
  kind text,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz default now()
);

create table users_profiles (
  user_id uuid primary key,
  org_id uuid not null references orgs(id) on delete cascade,
  display_name text,
  role text,
  avatar_url text
);

create table crews (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  capacity int default 2
);

create table trucks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  capacity int
);

-- ─── Tariffs (first-class) ────────────────────────────────────────────
create table tariffs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  branch_id uuid references branches(id),
  service_type text,
  effective_from date,
  effective_to date,
  currency text default 'USD',
  rounding_rule text,
  is_default boolean default false,
  archived boolean default false,
  created_at timestamptz default now()
);

create table tariff_rates (
  id uuid primary key default gen_random_uuid(),
  tariff_id uuid not null references tariffs(id) on delete cascade,
  kind text not null,
  label text,
  base_rate numeric,
  min_charge numeric default 0,
  unit text,
  conditions_json jsonb default '{}'::jsonb
);

create table tariff_tiers (
  id uuid primary key default gen_random_uuid(),
  tariff_rate_id uuid not null references tariff_rates(id) on delete cascade,
  threshold numeric,
  rate numeric
);

create table tariff_modifiers (
  id uuid primary key default gen_random_uuid(),
  tariff_id uuid not null references tariffs(id) on delete cascade,
  kind text not null,
  formula_json jsonb default '{}'::jsonb,
  stacking_order int default 0
);

create table tariff_valuations (
  id uuid primary key default gen_random_uuid(),
  tariff_id uuid not null references tariffs(id) on delete cascade,
  name text not null,
  coverage_type text,
  deductible numeric,
  rate_per_thousand numeric
);

create table tariff_handicaps (
  id uuid primary key default gen_random_uuid(),
  tariff_id uuid not null references tariffs(id) on delete cascade,
  name text not null,
  multiplier numeric default 1,
  condition_json jsonb default '{}'::jsonb
);

create table tariff_assignments (
  id uuid primary key default gen_random_uuid(),
  tariff_id uuid not null references tariffs(id) on delete cascade,
  branch_id uuid references branches(id),
  opportunity_type text,
  service_type text,
  priority int default 0
);

-- ─── Integrations + Sync state ────────────────────────────────────────
create table integration_credentials (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  provider_key text not null,
  config jsonb default '{}'::jsonb,
  secrets jsonb default '{}'::jsonb,
  enabled boolean default true,
  created_at timestamptz default now(),
  unique (org_id, provider_key)
);

create table sync_state (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  provider_key text not null,
  table_name text not null,
  cursor timestamptz,
  rows_synced bigint default 0,
  last_run_at timestamptz,
  unique (org_id, provider_key, table_name)
);

create table call_coaching (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  call_id uuid,
  agent_ext text,
  score numeric,
  rubric_json jsonb default '{}'::jsonb,
  coach_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz default now()
);

create table ai_usage (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  user_id uuid,
  tool text,
  tokens_in int,
  tokens_out int,
  cost_estimate numeric,
  created_at timestamptz default now()
);

-- ─── RLS (v0: anon all, matches 0001 posture for unauthed dev) ────────
do $$
declare t text;
begin
  for t in select unnest(array[
    'branches','customers','opportunities','estimates','jobs','calendar_events',
    'tasks','tickets','claims','sms_logs','email_logs','templates','events',
    'automations','automation_runs','notifications','users_profiles','crews','trucks',
    'tariffs','tariff_rates','tariff_tiers','tariff_modifiers','tariff_valuations',
    'tariff_handicaps','tariff_assignments','integration_credentials','sync_state',
    'call_coaching','ai_usage'
  ]) loop
    execute format('alter table %I enable row level security;', t);
    execute format($f$create policy "v0 anon all" on %I for all using (true) with check (true);$f$, t);
  end loop;
end $$;

-- ─── Seed default org branches (4 brands) ─────────────────────────────
do $$
declare default_org uuid;
begin
  select id into default_org from orgs limit 1;
  if default_org is null then
    insert into orgs(id, name) values ('00000000-0000-0000-0000-000000000001','Default') returning id into default_org;
  end if;
  insert into branches(org_id, name, brand_code, is_default) values
    (default_org, 'A Perfect Mover', 'APM', true),
    (default_org, 'A Friend with a Truck', 'AFM', false),
    (default_org, 'CrewReady', 'crewready', false),
    (default_org, 'Apex', 'apex', false)
  on conflict do nothing;
end $$;
