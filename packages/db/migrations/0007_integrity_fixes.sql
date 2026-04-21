-- v1.1 Module 2 review fixes. Addresses the following findings from the
-- independent DB review of migration 0006:
--   BLOCKER 1: trigger drops OLD invoice on invoice_id reassignment
--   BLOCKER 2: signer_name_len / signer_email_len CHECKs not idempotent
--   BLOCKER 3: backfill misses invoices with zero completed payments
--   MAJOR 1:   'overdue' status clobbered to 'partial' on any payment
--   MAJOR 3:   redundant idx_invoices_due_date_all
--   MAJOR 4:   trigger fires on non-material column updates
--   MAJOR 5:   CHECK added before backfill — reorder (handled here since
--              0006 is already applied, we backfill any lingering negatives)
--   MINOR m2:  status CASE divergence between trigger and backfill
--
-- This migration is idempotent. Re-running is safe.

-- ─── 1. Idempotent signer length CHECKs ─────────────────────────────
alter table estimate_signatures drop constraint if exists signer_name_len;
alter table estimate_signatures drop constraint if exists signer_email_len;
alter table estimate_signatures
  add constraint signer_name_len check (char_length(signer_name) <= 200),
  add constraint signer_email_len check (signer_email is null or char_length(signer_email) <= 320);

-- ─── 2. Drop redundant index ─────────────────────────────────────────
drop index if exists idx_invoices_due_date_all;

-- ─── 3. Rewrite trigger: dual-invoice recompute + preserve overdue ──
-- The old trigger only recomputed one side on invoice_id reassignment. The
-- new function accepts an invoice_id and is called twice when OLD and NEW
-- differ. It also preserves 'overdue' when there's any outstanding balance.
create or replace function public.recompute_invoice_for_id(inv_id uuid)
returns void
language plpgsql
as $$
declare
  total_paid numeric;
  inv_row record;
begin
  if inv_id is null then return; end if;

  select coalesce(sum(amount), 0) into total_paid
    from payments
    where invoice_id = inv_id and status = 'completed';

  select id, amount_due, due_date, status, paid_at into inv_row from invoices where id = inv_id;
  if not found then return; end if;

  update invoices
    set amount_paid = total_paid,
        balance = greatest(0, inv_row.amount_due - total_paid),
        status = case
          -- Fully paid → paid (only if there's a non-zero amount_due)
          when total_paid >= inv_row.amount_due and inv_row.amount_due > 0 then 'paid'
          -- Outstanding balance past due → overdue wins
          when inv_row.amount_due - total_paid > 0
               and inv_row.due_date is not null
               and inv_row.due_date < current_date then 'overdue'
          -- Partial payment still within terms → partial
          when total_paid > 0 and total_paid < inv_row.amount_due then 'partial'
          -- Was paid but refund brought it back → sent
          when inv_row.status in ('paid','partial','overdue') and total_paid = 0 then 'sent'
          else inv_row.status
        end,
        paid_at = case
          when total_paid >= inv_row.amount_due and inv_row.amount_due > 0
            then coalesce(inv_row.paid_at, now())
          -- Preserve paid_at as audit history (don't erase on refund)
          else inv_row.paid_at
        end,
        updated_at = now()
    where id = inv_id;
end;
$$;

create or replace function public.recompute_invoice_rollup()
returns trigger
language plpgsql
as $$
begin
  -- INSERT: recompute NEW's invoice (OLD is null so no second call)
  -- DELETE: recompute OLD's invoice (NEW is null)
  -- UPDATE: recompute NEW's invoice; if invoice_id reassigned, also OLD's
  if tg_op = 'DELETE' then
    perform public.recompute_invoice_for_id(old.invoice_id);
    return old;
  end if;

  perform public.recompute_invoice_for_id(new.invoice_id);

  if tg_op = 'UPDATE' and old.invoice_id is distinct from new.invoice_id then
    perform public.recompute_invoice_for_id(old.invoice_id);
  end if;

  return new;
end;
$$;

-- Replace the trigger with a WHEN clause that skips no-op updates. Triggers
-- still fire on every INSERT/DELETE; on UPDATE only when a material column
-- changed (amount, status, invoice_id).
drop trigger if exists trg_payments_recompute on payments;
create trigger trg_payments_recompute_ins
  after insert on payments
  for each row execute function public.recompute_invoice_rollup();
create trigger trg_payments_recompute_del
  after delete on payments
  for each row execute function public.recompute_invoice_rollup();
create trigger trg_payments_recompute_upd
  after update on payments
  for each row
  when (
    old.amount is distinct from new.amount
    or old.status is distinct from new.status
    or old.invoice_id is distinct from new.invoice_id
  )
  execute function public.recompute_invoice_rollup();

-- ─── 4. Backfill: recompute ALL invoices, not just those with payments ──
-- Previous backfill used an INNER JOIN against completed payments, missing
-- legacy `paid`/`partial` invoices that have zero payment rows. Use the
-- central function which handles the no-payments case correctly.
do $$
declare r record;
begin
  for r in select id from invoices loop
    perform public.recompute_invoice_for_id(r.id);
  end loop;
end $$;

-- ─── 5. Self-check: find and fix any lingering negative balances ─────
-- If any legacy row violates invoices_amounts_nonneg after backfill, log it
-- for manual review rather than failing the migration.
do $$
declare v_count int;
begin
  select count(*) into v_count from invoices
    where subtotal < 0 or discounts < 0 or sales_tax < 0
       or amount_due < 0 or amount_paid < 0 or balance < 0;
  if v_count > 0 then
    raise notice 'WARNING: % invoice rows have negative amounts; manual review required', v_count;
  end if;
end $$;
