-- Single-use bridge-token replay protection.
-- Every accepted v1b. token inserts its jti here. TTL-bounded by
-- the token's own exp (max 5min), so a nightly cleanup suffices.
create table if not exists bridge_jti_denylist (
  jti text primary key,
  company_id text not null,
  consumed_at timestamptz default now(),
  exp timestamptz not null
);
create index if not exists bridge_jti_exp_idx on bridge_jti_denylist(exp);
-- permissive "v0 anon all" policy (RLS keeps DB queriable by service-role).
alter table bridge_jti_denylist enable row level security;
create policy "v0 anon all" on bridge_jti_denylist for all using (true) with check (true);
