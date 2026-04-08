-- 0003 launch hardening: organizations table, memberships FK repoint, RLS.
-- Applied live as:
--   launch_l1_org_tables
--   launch_l2_real_rls
--   fix_memberships_fk_to_organizations

CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  plan text NOT NULL DEFAULT 'free',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.organizations (id, name, slug, plan)
VALUES ('00000000-0000-0000-0000-000000000001', 'Default', 'default', 'free')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.memberships ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.memberships ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'memberships_org_user_uq') THEN
    ALTER TABLE public.memberships ADD CONSTRAINT memberships_org_user_uq UNIQUE (org_id, user_id);
  END IF;
END $$;

-- Repoint memberships.org_id FK from legacy `orgs` to `organizations`.
ALTER TABLE public.memberships DROP CONSTRAINT IF EXISTS memberships_org_id_fkey;
ALTER TABLE public.memberships
  ADD CONSTRAINT memberships_org_id_fkey
  FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

-- RLS helper: SECURITY DEFINER to break circular dep on memberships policy.
CREATE OR REPLACE FUNCTION public.get_my_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM public.memberships WHERE user_id = auth.uid() LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_my_org_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_org_id() TO authenticated, anon, service_role;

-- Tenant isolation on all org-scoped tables.
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'activities','agent_runs','agents','ai_usage','api_keys','automations','branches',
    'calendar_events','call_coaching','claims','crews','customers','email_logs','embeddings',
    'estimates','events','integrations','jobs','notifications','objects',
    'opportunities','pipelines','plugins','records','relations','sms_logs','sync_state',
    'tariffs','tasks','templates','tickets','trucks','users_profiles','integration_credentials'
  ];
  pol record;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
    END LOOP;
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON public.%I FOR ALL TO authenticated USING (org_id = public.get_my_org_id()) WITH CHECK (org_id = public.get_my_org_id())',
      t
    );
  END LOOP;
END $$;

ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS memberships_self ON public.memberships;
CREATE POLICY memberships_self ON public.memberships
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS organizations_self ON public.organizations;
CREATE POLICY organizations_self ON public.organizations
  FOR SELECT TO authenticated
  USING (id = public.get_my_org_id());
