-- v1.1 Module I1: callscraper.com → CRM organization mapping.
--
-- Adds an optional column on `organizations` that records the callscraper.com
-- workspace id (companies.id in the upstream project `earddtfueyboluglwbgt`).
-- When a callscraper user lands in the CRM via the /launch deep-link, the
-- auth-bridge resolves their bridge-token's `upstream_company_id` claim to
-- the matching CRM org_id.
--
-- DESIGN DECISIONS (documented here and in INTEGRATION.md):
--
-- 1. `upstream_company_id` is NULLABLE.
--    Standalone CRM installs have no callscraper workspace. We only populate
--    this column when a workspace opts in to the integration (via settings
--    UI or admin action).
--
-- 2. `upstream_company_id` is NOT UNIQUE.
--    Flagged by the I1 direction-review: forcing UNIQUE now prevents a single
--    callscraper workspace from mapping to multiple CRM orgs (e.g. when a
--    franchise has one upstream brand feeding multiple regional CRM orgs).
--    The opposite direction (multiple upstream workspaces to one CRM org)
--    is also sometimes legitimate. The foreign-key semantics will tighten
--    in v1.2 when we understand the real workspace topology. For now: index
--    only, no constraint.
--
-- 3. A non-unique btree index supports the primary read pattern: "find the
--    CRM org for this callscraper company_id". Multi-result ambiguity is
--    resolved at the application layer (e.g. return the most-recently-created
--    match, or prompt the user in a chooser UI — v1.2).

alter table organizations
  add column if not exists upstream_company_id text;

create index if not exists idx_organizations_upstream_company_id
  on organizations (upstream_company_id)
  where upstream_company_id is not null;

comment on column organizations.upstream_company_id is
  'callscraper.com company.id this CRM org is linked to. Nullable (standalone installs). Non-unique (see migration 0009 notes).';
