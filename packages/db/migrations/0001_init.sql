-- CallscraperCRM initial schema
-- Metadata-driven core: objects/fields/records + first-class CRM tables for hot paths.

create extension if not exists "pgcrypto";
create extension if not exists "vector";

-- ─── Orgs & Membership ────────────────────────────────────────────────
create table orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

create table memberships (
  org_id uuid references orgs(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text not null default 'owner',
  primary key (org_id, user_id)
);

-- ─── Metadata: Objects & Fields ───────────────────────────────────────
create table objects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  key text not null,
  label text not null,
  is_system boolean default false,
  created_at timestamptz default now(),
  unique (org_id, key)
);

create table fields (
  id uuid primary key default gen_random_uuid(),
  object_id uuid not null references objects(id) on delete cascade,
  key text not null,
  label text not null,
  type text not null, -- text, number, bool, date, json, ref, vector
  config jsonb default '{}'::jsonb,
  unique (object_id, key)
);

create table records (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  object_id uuid not null references objects(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index records_org_object_idx on records(org_id, object_id);
create index records_data_gin on records using gin(data);

create table relations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  from_record uuid not null references records(id) on delete cascade,
  to_record uuid not null references records(id) on delete cascade,
  kind text not null
);

-- ─── Pipelines ────────────────────────────────────────────────────────
create table pipelines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  object_key text not null default 'deal'
);

create table stages (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references pipelines(id) on delete cascade,
  name text not null,
  position int not null
);

-- ─── Activities (timeline) ────────────────────────────────────────────
create table activities (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  record_id uuid references records(id) on delete cascade,
  kind text not null, -- call, email, note, task, system
  payload jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- ─── Integrations & Plugins ───────────────────────────────────────────
create table integrations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  plugin_key text not null,
  mode text not null, -- rest | webhook | fdw | scraper
  config jsonb default '{}'::jsonb,
  secrets jsonb default '{}'::jsonb,
  enabled boolean default true,
  created_at timestamptz default now()
);

create table plugins (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  key text not null,
  manifest jsonb not null,
  installed_at timestamptz default now(),
  unique (org_id, key)
);

-- ─── AI Agents & Embeddings ───────────────────────────────────────────
create table agents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  system_prompt text not null,
  model text not null default 'claude-opus-4-6',
  tools text[] default '{}',
  triggers jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

create table embeddings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  record_id uuid references records(id) on delete cascade,
  content text not null,
  embedding vector(1536)
);
create index embeddings_ivfflat on embeddings using ivfflat (embedding vector_cosine_ops);

-- ─── API Keys ─────────────────────────────────────────────────────────
create table api_keys (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  key_hash text not null,
  created_at timestamptz default now()
);

-- ─── RLS ──────────────────────────────────────────────────────────────
alter table orgs enable row level security;
alter table memberships enable row level security;
alter table objects enable row level security;
alter table fields enable row level security;
alter table records enable row level security;
alter table relations enable row level security;
alter table pipelines enable row level security;
alter table stages enable row level security;
alter table activities enable row level security;
alter table integrations enable row level security;
alter table plugins enable row level security;
alter table agents enable row level security;
alter table embeddings enable row level security;
alter table api_keys enable row level security;

create or replace function current_org_ids() returns setof uuid
language sql stable as $$
  select org_id from memberships where user_id = auth.uid();
$$;

create policy "members read orgs" on orgs for select
  using (id in (select current_org_ids()));

create policy "members all memberships" on memberships for all
  using (user_id = auth.uid());

-- Generic policy macro applied per-table
do $$
declare t text;
begin
  for t in select unnest(array[
    'objects','records','relations','pipelines',
    'activities','integrations','plugins','agents','embeddings','api_keys'
  ]) loop
    execute format($f$
      create policy "org members rw" on %I for all
        using (org_id in (select current_org_ids()))
        with check (org_id in (select current_org_ids()));
    $f$, t);
  end loop;
end $$;

-- Fields inherit via object
create policy "org members fields" on fields for all
  using (object_id in (select id from objects where org_id in (select current_org_ids())))
  with check (object_id in (select id from objects where org_id in (select current_org_ids())));

create policy "org members stages" on stages for all
  using (pipeline_id in (select id from pipelines where org_id in (select current_org_ids())))
  with check (pipeline_id in (select id from pipelines where org_id in (select current_org_ids())));
