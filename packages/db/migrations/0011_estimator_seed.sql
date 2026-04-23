-- 0011 estimator seed: shops + margin policies + default fuel surcharge.
--
-- Shop addresses supplied by operator 2026-04-22:
--   1) 12826 Avondale Way, Everett, WA 98204
--   2) 4000 156th St NE, Suite 110, Marysville, WA 98271
--
-- Both yards serve BOTH brands (A Perfect Mover and Affordable Movers LLC).
-- They're seeded for every existing organization that does not yet have
-- any shops configured. If an org prefers brand-specific yards, deactivate
-- these and add new ones via /settings/shops.
--
-- Also seeds the default margin policies (35/45 local, 43/50 long-distance)
-- in case the 0010 aggregation function has not been run yet.

insert into public.shops (org_id, name, address, is_active)
select o.id, 'Everett HQ', '12826 Avondale Way, Everett, WA 98204', true
from public.organizations o
where not exists (
  select 1 from public.shops s where s.org_id = o.id
);

insert into public.shops (org_id, name, address, is_active)
select o.id, 'Marysville Warehouse', '4000 156th St NE, Suite 110, Marysville, WA 98271', true
from public.organizations o
where not exists (
  select 1 from public.shops s
  where s.org_id = o.id
    and s.address = '4000 156th St NE, Suite 110, Marysville, WA 98271'
);

-- Default margin policies — match 0010 aggregation function's seed clause, but
-- useful to run standalone before the first scrape completes.
insert into public.margin_policies (org_id, move_class, min_margin_pct, target_margin_pct)
select o.id, 'local', 35, 45
from public.organizations o
where not exists (
  select 1 from public.margin_policies mp
  where mp.org_id = o.id and mp.move_class = 'local'
);

insert into public.margin_policies (org_id, move_class, min_margin_pct, target_margin_pct)
select o.id, 'long_distance', 43, 50
from public.organizations o
where not exists (
  select 1 from public.margin_policies mp
  where mp.org_id = o.id and mp.move_class = 'long_distance'
);
