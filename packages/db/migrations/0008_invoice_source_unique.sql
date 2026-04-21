-- v1.1 Module 3 review fix: make invoice-source uniqueness authoritative.
--
-- Migration 0006 only gave us UNIQUE (org_id, invoice_number). That meant
-- our idempotency for auto-invoicing relied on the deterministic invoice
-- number scheme, which would silently collide with user-created invoices
-- that happen to share the same prefix (BLOCKER B1 from Module 3 review).
--
-- The real invariant we want is: at most one non-voided invoice per
-- (org_id, estimate_id) and at most one per (org_id, job_id). Partial unique
-- indexes express this directly — they ignore NULL source ids (most manual
-- invoices) and exclude 'void' so a voided invoice can be replaced.

drop index if exists invoices_one_per_estimate;
create unique index invoices_one_per_estimate
  on invoices (org_id, estimate_id)
  where estimate_id is not null and status <> 'void';

drop index if exists invoices_one_per_job;
create unique index invoices_one_per_job
  on invoices (org_id, job_id)
  where job_id is not null and status <> 'void';
