-- v1.1 Phase 1B: Tariff seeds + invoices/payments/inventory/signatures/settings tables.
-- Adds the missing `label` column on tariff_modifiers, seeds default tariffs for
-- APM and AFM, and creates the supporting tables for estimates → invoices → payments.

-- ─── 0. Patch tariff_modifiers with label column ─────────────────────
alter table tariff_modifiers add column if not exists label text;

-- ─── 1. Invoices + Payments ──────────────────────────────────────────
create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  job_id uuid references jobs(id),
  opportunity_id uuid references opportunities(id),
  customer_id uuid references customers(id),
  estimate_id uuid references estimates(id),
  invoice_number text,
  status text not null default 'draft', -- draft, sent, partial, paid, void, overdue
  line_items_json jsonb default '[]'::jsonb,
  subtotal numeric default 0,
  discounts numeric default 0,
  sales_tax numeric default 0,
  amount_due numeric default 0,
  amount_paid numeric default 0,
  balance numeric default 0,
  due_date date,
  issued_at timestamptz,
  paid_at timestamptz,
  payment_method text,
  payment_reference text,
  notes text,
  pdf_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_invoices_org_status on invoices(org_id, status);
create index if not exists idx_invoices_customer on invoices(customer_id);
create index if not exists idx_invoices_due_date on invoices(due_date) where status in ('sent','partial','overdue');

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  invoice_id uuid references invoices(id),
  estimate_id uuid references estimates(id), -- for deposit payments before invoice exists
  customer_id uuid references customers(id),
  amount numeric not null,
  method text not null, -- card, cash, check, ach
  status text not null default 'pending', -- pending, completed, failed, refunded
  stripe_payment_id text,
  reference text,
  processed_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists idx_payments_invoice on payments(invoice_id);
create index if not exists idx_payments_org on payments(org_id);

-- ─── 2. Inventory items (room-based) ─────────────────────────────────
create table if not exists inventory_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  room_name text not null,
  item_name text not null,
  quantity int default 1,
  weight_lbs numeric,
  cubic_feet numeric,
  is_heavy boolean default false,
  notes text,
  created_at timestamptz default now()
);
create index if not exists idx_inventory_opp on inventory_items(opportunity_id);

-- ─── 3. Estimate signatures ──────────────────────────────────────────
create table if not exists estimate_signatures (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references estimates(id) on delete cascade,
  signer_name text not null,
  signer_email text,
  signature_data text not null, -- base64-encoded PNG
  ip_address text,
  signed_at timestamptz default now()
);
create index if not exists idx_signatures_estimate on estimate_signatures(estimate_id);

-- ─── 4. Generic settings store ───────────────────────────────────────
create table if not exists settings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  category text not null,
  key text not null,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (org_id, category, key)
);
create index if not exists idx_settings_org_category on settings(org_id, category);

-- ─── 5. Estimate columns: type, number, deposit, inventory snapshot ──
alter table estimates add column if not exists estimate_type text default 'non_binding';
alter table estimates add column if not exists estimate_number text;
alter table estimates add column if not exists deposit_amount numeric default 0;
alter table estimates add column if not exists deposit_paid_at timestamptz;
alter table estimates add column if not exists inventory_snapshot jsonb;

-- Customers: stripe_customer_id for card-on-file (Phase 4)
alter table customers add column if not exists stripe_customer_id text;

-- ─── 6. RLS for new tables ───────────────────────────────────────────
alter table invoices enable row level security;
alter table payments enable row level security;
alter table inventory_items enable row level security;
alter table estimate_signatures enable row level security;
alter table settings enable row level security;

-- Tenant isolation: org_id matches the caller's org. Service-role bypasses.
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'invoices' and policyname = 'tenant_isolation') then
    create policy tenant_isolation on invoices using (org_id = public.get_my_org_id()) with check (org_id = public.get_my_org_id());
  end if;
  if not exists (select 1 from pg_policies where tablename = 'payments' and policyname = 'tenant_isolation') then
    create policy tenant_isolation on payments using (org_id = public.get_my_org_id()) with check (org_id = public.get_my_org_id());
  end if;
  if not exists (select 1 from pg_policies where tablename = 'inventory_items' and policyname = 'tenant_isolation') then
    create policy tenant_isolation on inventory_items using (org_id = public.get_my_org_id()) with check (org_id = public.get_my_org_id());
  end if;
  if not exists (select 1 from pg_policies where tablename = 'settings' and policyname = 'tenant_isolation') then
    create policy tenant_isolation on settings using (org_id = public.get_my_org_id()) with check (org_id = public.get_my_org_id());
  end if;
  -- estimate_signatures has no org_id; isolate via parent estimate
  if not exists (select 1 from pg_policies where tablename = 'estimate_signatures' and policyname = 'tenant_isolation') then
    create policy tenant_isolation on estimate_signatures
      using (exists (select 1 from estimates e where e.id = estimate_signatures.estimate_id and e.org_id = public.get_my_org_id()))
      with check (exists (select 1 from estimates e where e.id = estimate_signatures.estimate_id and e.org_id = public.get_my_org_id()));
  end if;
end $$;

-- ─── 7. Seed APM + AFM default tariffs ───────────────────────────────
-- Use a CTE-style with deterministic anchors so re-runs are idempotent.
-- We anchor by (org_id, name) and skip if a tariff with that name exists.

do $$
declare
  v_org_id uuid := '00000000-0000-0000-0000-000000000001';
  v_apm_branch_id uuid;
  v_afm_branch_id uuid;
  v_apm_tariff_id uuid;
  v_afm_tariff_id uuid;
begin
  select id into v_apm_branch_id from branches where brand_code = 'APM' and org_id = v_org_id;
  select id into v_afm_branch_id from branches where brand_code = 'AFM' and org_id = v_org_id;

  -- APM tariff
  select id into v_apm_tariff_id from tariffs where org_id = v_org_id and name = 'APM Standard Local';
  if v_apm_tariff_id is null then
    insert into tariffs (org_id, name, branch_id, service_type, effective_from, currency, rounding_rule, is_default)
    values (v_org_id, 'APM Standard Local', v_apm_branch_id, 'local_move', '2026-01-01', 'USD', 'nearest_cent', true)
    returning id into v_apm_tariff_id;

    insert into tariff_rates (tariff_id, kind, label, base_rate, min_charge, unit, conditions_json) values
      (v_apm_tariff_id, 'labor', 'Mover (per hour)', 175, 525, 'hour', '{}'::jsonb),
      (v_apm_tariff_id, 'truck', 'Truck (per hour)', 125, 250, 'hour', '{}'::jsonb),
      (v_apm_tariff_id, 'travel', 'Travel fee', 150, 0, 'flat', '{}'::jsonb),
      (v_apm_tariff_id, 'mileage', 'Long-distance mileage', 4.50, 0, 'mile', '{}'::jsonb),
      (v_apm_tariff_id, 'packing', 'Packing materials', 75, 0, 'flat', '{}'::jsonb);

    insert into tariff_modifiers (tariff_id, kind, label, formula_json, stacking_order) values
      (v_apm_tariff_id, 'weekend', 'Weekend surcharge', '{"type":"percentage","value":15}'::jsonb, 5),
      (v_apm_tariff_id, 'fuel_surcharge', 'Fuel surcharge', '{"type":"percentage","value":8}'::jsonb, 10),
      (v_apm_tariff_id, 'stairs', 'Stairs', '{"type":"per_flight","value":75}'::jsonb, 20),
      (v_apm_tariff_id, 'long_carry', 'Long carry', '{"type":"flat","value":100,"condition":{"min_ft":75}}'::jsonb, 30),
      (v_apm_tariff_id, 'heavy_item', 'Heavy item', '{"type":"per_item","value":50}'::jsonb, 40),
      (v_apm_tariff_id, 'holiday', 'Holiday', '{"type":"percentage","value":25,"condition":{"holidays":["2026-12-25","2026-01-01","2026-07-04","2026-11-26"]}}'::jsonb, 6),
      (v_apm_tariff_id, 'peak_season', 'Peak season (May-Sep)', '{"type":"percentage","value":10,"condition":{"start_month":5,"end_month":9}}'::jsonb, 7);

    insert into tariff_valuations (tariff_id, name, coverage_type, deductible, rate_per_thousand) values
      (v_apm_tariff_id, 'Released Value', 'released_value', 0, 0.60),
      (v_apm_tariff_id, 'Full Replacement', 'full_replacement', 250, 25.00);

    insert into tariff_handicaps (tariff_id, name, multiplier, condition_json) values
      (v_apm_tariff_id, 'Long distance (50+ mi)', 1.05, '{"distance_min":50}'::jsonb);

    insert into tariff_assignments (tariff_id, branch_id, service_type, priority) values
      (v_apm_tariff_id, v_apm_branch_id, 'local_move', 10),
      (v_apm_tariff_id, v_apm_branch_id, 'long_distance', 5);
  end if;

  -- AFM tariff
  select id into v_afm_tariff_id from tariffs where org_id = v_org_id and name = 'AFM Budget Local';
  if v_afm_tariff_id is null then
    insert into tariffs (org_id, name, branch_id, service_type, effective_from, currency, rounding_rule, is_default)
    values (v_org_id, 'AFM Budget Local', v_afm_branch_id, 'local_move', '2026-01-01', 'USD', 'nearest_cent', false)
    returning id into v_afm_tariff_id;

    insert into tariff_rates (tariff_id, kind, label, base_rate, min_charge, unit, conditions_json) values
      (v_afm_tariff_id, 'labor', 'Mover (per hour)', 135, 405, 'hour', '{}'::jsonb),
      (v_afm_tariff_id, 'truck', 'Truck (per hour)', 95, 190, 'hour', '{}'::jsonb),
      (v_afm_tariff_id, 'travel', 'Travel fee', 100, 0, 'flat', '{}'::jsonb);

    insert into tariff_modifiers (tariff_id, kind, label, formula_json, stacking_order) values
      (v_afm_tariff_id, 'weekend', 'Weekend surcharge', '{"type":"percentage","value":10}'::jsonb, 5),
      (v_afm_tariff_id, 'fuel_surcharge', 'Fuel surcharge', '{"type":"percentage","value":6}'::jsonb, 10),
      (v_afm_tariff_id, 'stairs', 'Stairs', '{"type":"per_flight","value":50}'::jsonb, 20);

    insert into tariff_valuations (tariff_id, name, coverage_type, deductible, rate_per_thousand) values
      (v_afm_tariff_id, 'Released Value', 'released_value', 0, 0.60);

    insert into tariff_assignments (tariff_id, branch_id, service_type, priority) values
      (v_afm_tariff_id, v_afm_branch_id, 'local_move', 10);
  end if;
end $$;
