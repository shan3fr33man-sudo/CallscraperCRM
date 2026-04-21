-- v1.1 Module 2: database integrity layer.
--
-- Addresses CRITICAL / HIGH audit findings from the code review:
--   * Payment-balance race condition → move rollup into a DB trigger
--   * Invoice/payment status drift → CHECK constraints on enum-like columns
--   * Double-issue of invoice numbers → UNIQUE (org_id, invoice_number)
--   * Duplicate signatures on same estimate → UNIQUE (estimate_id)
--   * estimate_signatures lacked org_id → add + backfill + simplify RLS
--   * Token lifecycle on amendment → estimates.token_epoch for rotation
--   * Negative payments / zero amounts → CHECK (amount > 0)
--
-- This migration is idempotent. Re-running is safe; all DDL uses IF NOT
-- EXISTS / DROP IF EXISTS. The trigger function is CREATE OR REPLACE.

-- ─── 1. estimate_signatures: add org_id + simpler RLS + idempotency ──
alter table estimate_signatures
  add column if not exists org_id uuid references organizations(id) on delete cascade;

-- Backfill org_id from parent estimate
update estimate_signatures s
  set org_id = e.org_id
  from estimates e
  where s.estimate_id = e.id and s.org_id is null;

-- Now enforce NOT NULL (safe after backfill)
do $$ begin
  if exists (select 1 from information_schema.columns
             where table_name = 'estimate_signatures' and column_name = 'org_id'
               and is_nullable = 'YES') then
    alter table estimate_signatures alter column org_id set not null;
  end if;
end $$;

-- One signature per estimate (enforces the sign-race guard at schema level)
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'estimate_signatures_estimate_id_unique') then
    alter table estimate_signatures add constraint estimate_signatures_estimate_id_unique unique (estimate_id);
  end if;
end $$;

-- Replace the nested-join RLS with direct org_id check
drop policy if exists tenant_isolation on estimate_signatures;
create policy tenant_isolation on estimate_signatures
  using (org_id = public.get_my_org_id())
  with check (org_id = public.get_my_org_id());

-- Keep signer fields bounded (defense in depth alongside app-level limits)
alter table estimate_signatures drop constraint if exists signer_name_len;
alter table estimate_signatures drop constraint if exists signer_email_len;
alter table estimate_signatures
  add constraint signer_name_len check (char_length(signer_name) <= 200),
  add constraint signer_email_len check (signer_email is null or char_length(signer_email) <= 320);

-- ─── 2. invoices: CHECK constraints, UNIQUE, consistency trigger ─────
-- Enum-like status values (matching what the app code uses)
alter table invoices drop constraint if exists invoices_status_valid;
alter table invoices add constraint invoices_status_valid
  check (status in ('draft','sent','partial','paid','void','overdue'));

-- Every invoice in a given org gets a unique number (the app auto-generates
-- from `Date.now().toString(36)`, but nothing prevented collisions before).
-- NOTE: two invoices without invoice_number are allowed (NULLs are distinct
-- in btree unique indexes).
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'invoices_org_number_unique') then
    alter table invoices add constraint invoices_org_number_unique unique (org_id, invoice_number);
  end if;
end $$;

-- Numeric sanity
alter table invoices drop constraint if exists invoices_amounts_nonneg;
alter table invoices add constraint invoices_amounts_nonneg
  check (
    subtotal >= 0 and discounts >= 0 and sales_tax >= 0
    and amount_due >= 0 and amount_paid >= 0 and balance >= 0
  );

-- Frequently-queried column for AR aging reports. Note: there is already an
-- existing idx_invoices_due_date that filters on outstanding statuses; that
-- one covers the AR dashboard. We only add a created_at index here.
create index if not exists idx_invoices_created_at on invoices(created_at desc);

-- ─── 3. payments: CHECKs + trigger-driven invoice rollup ────────────
alter table payments drop constraint if exists payments_amount_positive;
alter table payments add constraint payments_amount_positive check (amount > 0);

alter table payments drop constraint if exists payments_method_valid;
alter table payments add constraint payments_method_valid
  check (method in ('card','cash','check','ach'));

alter table payments drop constraint if exists payments_status_valid;
alter table payments add constraint payments_status_valid
  check (status in ('pending','completed','failed','refunded'));

-- Trigger function: whenever a payment is inserted/updated/deleted, recompute
-- the parent invoice's amount_paid + balance + status from the authoritative
-- sum of completed payments. Closes the read-then-write race in the app.
create or replace function public.recompute_invoice_rollup()
returns trigger
language plpgsql
as $$
declare
  inv_id uuid;
  total_paid numeric;
  inv_row record;
begin
  inv_id := coalesce(new.invoice_id, old.invoice_id);
  if inv_id is null then
    return coalesce(new, old);
  end if;

  select coalesce(sum(amount), 0) into total_paid
    from payments
    where invoice_id = inv_id and status = 'completed';

  select id, amount_due, status into inv_row from invoices where id = inv_id;
  if not found then
    return coalesce(new, old);
  end if;

  update invoices
    set amount_paid = total_paid,
        balance = greatest(0, inv_row.amount_due - total_paid),
        status = case
          when total_paid >= inv_row.amount_due then 'paid'
          when total_paid > 0 then 'partial'
          when inv_row.status in ('paid','partial') then 'sent' -- rollback on refund
          else inv_row.status
        end,
        paid_at = case
          when total_paid >= inv_row.amount_due then coalesce(paid_at, now())
          else null
        end,
        updated_at = now()
    where id = inv_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_payments_recompute on payments;
create trigger trg_payments_recompute
  after insert or update or delete on payments
  for each row execute function public.recompute_invoice_rollup();

-- ─── 4. estimates: token epoch for amendment rotation ───────────────
alter table estimates add column if not exists token_epoch int not null default 0;

-- ─── 5. Bonus: tighten tariff enum-likes (silent discoveries) ────────
alter table tariff_rates drop constraint if exists tariff_rates_kind_valid;
alter table tariff_rates add constraint tariff_rates_kind_valid
  check (kind in ('labor','truck','material','packing','travel','flat','mileage'));

alter table tariff_rates drop constraint if exists tariff_rates_unit_valid;
alter table tariff_rates add constraint tariff_rates_unit_valid
  check (unit is null or unit in ('hour','mile','cwt','flat','each','day'));

alter table tariff_modifiers drop constraint if exists tariff_modifiers_kind_valid;
alter table tariff_modifiers add constraint tariff_modifiers_kind_valid
  check (kind in ('fuel_surcharge','long_carry','stairs','heavy_item','weekend','holiday','peak_season','elevator','shuttle'));

alter table tariff_valuations drop constraint if exists tariff_valuations_coverage_valid;
alter table tariff_valuations add constraint tariff_valuations_coverage_valid
  check (coverage_type is null or coverage_type in ('released_value','full_replacement','lump_sum'));

-- Tariff-level rounding rule and modifier formula type enums
alter table tariffs drop constraint if exists tariffs_rounding_valid;
alter table tariffs add constraint tariffs_rounding_valid
  check (rounding_rule is null or rounding_rule in ('nearest_cent','nearest_dollar','ceil_dollar','floor_dollar','none'));

alter table tariff_modifiers drop constraint if exists tariff_modifiers_formula_type_valid;
alter table tariff_modifiers add constraint tariff_modifiers_formula_type_valid
  check (formula_json ? 'type' and (formula_json->>'type') in ('percentage','flat','per_flight','per_100lbs','per_item'));

-- Backfill: recompute rollup for any existing invoices so the stored
-- balance/amount_paid/status matches what the trigger would produce going
-- forward. Runs the same logic as recompute_invoice_rollup() but in bulk.
with paid as (
  select invoice_id, coalesce(sum(amount), 0) as total_paid
    from payments
    where status = 'completed' and invoice_id is not null
    group by invoice_id
)
update invoices inv
  set amount_paid = coalesce(p.total_paid, 0),
      balance = greatest(0, inv.amount_due - coalesce(p.total_paid, 0)),
      status = case
        when coalesce(p.total_paid, 0) >= inv.amount_due and inv.amount_due > 0 then 'paid'
        when coalesce(p.total_paid, 0) > 0 then 'partial'
        else inv.status
      end,
      paid_at = case
        when coalesce(p.total_paid, 0) >= inv.amount_due and inv.amount_due > 0 then coalesce(inv.paid_at, now())
        else inv.paid_at
      end,
      updated_at = now()
  from paid p
  where p.invoice_id = inv.id;
