-- 0004: Fix FK references from legacy orgs→organizations, deduplicate customers, add unique index.
-- Applied live 2026-04-17.

-- 1. Drop polymorphic FK on activities.record_id (it references customers, opportunities, etc.)
ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_record_id_fkey;

-- 2. Repoint all org_id FKs from legacy `orgs` to `organizations`
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conrelid::regclass::text AS tbl, conname
    FROM pg_constraint
    WHERE contype = 'f' AND confrelid = 'orgs'::regclass
  LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', r.tbl, r.conname);
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE', r.tbl, r.conname);
  END LOOP;
END $$;

-- 3. Deduplicate customers (keep oldest per org+phone)
DELETE FROM customers
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY org_id, customer_phone
      ORDER BY created_at ASC
    ) as rn
    FROM customers
    WHERE customer_phone IS NOT NULL AND customer_phone != ''
  ) ranked
  WHERE rn > 1
);

-- 4. Add unique partial index on (org_id, customer_phone)
CREATE UNIQUE INDEX IF NOT EXISTS customers_org_phone_uq
ON customers (org_id, customer_phone)
WHERE customer_phone IS NOT NULL AND customer_phone != '';
