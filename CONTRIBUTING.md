# Contributing to CallscraperCRM

Short reference for day-to-day development. If you're here to review, read [`REVIEW.md`](./REVIEW.md) first.

## Prerequisites

- Node 22.x or newer (the repo uses Node's native TypeScript stripping)
- pnpm 10.x (workspace tool)
- Supabase account + project credentials in `apps/web/.env.local`
- For public estimate endpoints locally: `ESTIMATE_SIGNING_SECRET` set OR `ALLOW_DEV_SECRET=1`

Bootstrap:

```bash
pnpm install
cp .env.production.example apps/web/.env.local   # fill in real keys
pnpm --filter @callscrapercrm/web dev             # http://localhost:3000
```

## Repo layout

```
apps/web/                      Next.js 15 app (the CRM UI + API)
  src/app/                     App Router pages and API routes
  src/components/              Reusable UI components
  src/lib/                     Shared server/client helpers
  src/lib/__tests__/           node --test unit tests
  e2e/                         Playwright smoke suite
packages/
  pricing/                     Pure-TS pricing engine (browser + server)
  db/migrations/               SQL migrations, applied in filename order
  shared-types/                TypeScript types shared with upstream callscraper
scripts/                       Dev-only utilities (seed, lint, vocab check)
docs/                          Generated + curated reviewer docs
```

## Adding a new API route

Pattern to follow. This mirrors existing tariff routes and keeps every reviewer check trivial.

```ts
// apps/web/src/app/api/<resource>/route.ts
import { NextResponse } from "next/server";
import { crmClient } from "@/lib/crmdb";
import { getOrgId } from "@/lib/auth";
import { emitEvent } from "@/lib/river";
import { parseBody, stripUndefined } from "@/lib/validate";
import { myCreateSchema } from "@callscrapercrm/pricing"; // or a local schema

export const runtime = "nodejs";

export async function GET(req: Request) {
  const sb = crmClient();
  const orgId = await getOrgId();
  // Always scope by org_id on mutations and most reads
  const { data, error } = await sb.from("my_table").select("*").eq("org_id", orgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: Request) {
  const body = await parseBody(req, myCreateSchema);
  if (body instanceof Response) return body; // 400 with field errors

  const sb = crmClient();
  const orgId = await getOrgId();

  // If referencing a parent row, verify ownership
  // (pattern used in payments.ts, tariffs.ts — prevents cross-org writes)
  if (body.parent_id) {
    const { data: parent } = await sb
      .from("parents")
      .select("id")
      .eq("id", body.parent_id)
      .eq("org_id", orgId)
      .maybeSingle();
    if (!parent) return NextResponse.json({ error: "parent_id not found in this org" }, { status: 404 });
  }

  const { data, error } = await sb
    .from("my_table")
    .insert({ org_id: orgId, ...body })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Every state change emits an event — the automation engine reads these
  await emitEvent(sb, {
    org_id: orgId,
    type: "my_resource.created",
    related_type: "my_resource",
    related_id: data.id,
    payload: { id: data.id, /* + anything automations might match on */ },
  });

  return NextResponse.json({ item: data });
}
```

After adding the route, regenerate the inventory:

```bash
node --experimental-strip-types scripts/generate-route-inventory.ts
```

The CI check (todo) will fail PRs where `docs/ROUTE_INVENTORY.md` is stale.

## Adding a migration

```bash
# Number follows: 0001, 0002, ... — whatever comes next
touch packages/db/migrations/0009_whatever.sql
```

Rules:

1. **Idempotent** — every DDL uses `IF NOT EXISTS` / `DROP IF EXISTS` / a `DO $$ IF NOT EXISTS` guard. Re-running the file must be safe.
2. **Forward-only** — never edit an applied migration; write a follow-up (e.g. 0007_integrity_fixes.sql patched 0006).
3. **Commented** — the top of the file references the review finding / user story driving the change.
4. **Tested before apply** — use `mcp__b88...__apply_migration` with a fresh branch, or copy-paste into Supabase Studio SQL editor against a branch project.

RLS reminder: every new multi-tenant table needs:
```sql
alter table my_new enable row level security;
create policy tenant_isolation on my_new
  using (org_id = public.get_my_org_id())
  with check (org_id = public.get_my_org_id());
```

## Shared vocabulary

The upstream callscraper.com schema is the source of truth for field names. We adopt its column names in new tables instead of inventing CRM-native ones.

The full canonical list lives in `scripts/check-vocab.ts` — that script is the source of truth and runs in CI. Below is a pointer to the most-violated cases:

- `phone_number` / `phoneNumber` → use `from_number` / `to_number` / `customer_phone`
- `full_name` / `fullName` → use `customer_name`
- `email_address` / `emailAddress` → use `customer_email`
- `estimated_value` / `estimatedValue` → use `amount`
- `opp_status` / `oppStatus` → use `status`
- `assignee_id` / `assigneeId` → use `assigned_to`
- `job_number` / `jobNumber` → use `quote_number`

If you need to introduce a new alias, add it to the script's allowlist with a comment explaining why. Don't disable the check in CI.

## Tests

Three layers:

1. **Unit tests** (Node native `node:test`):
   ```bash
   node --experimental-strip-types --test apps/web/src/lib/__tests__/*.test.ts
   ```
   Pattern: one test file per lib module. Imports must use `.ts` extension for Node's loader.

2. **Type check**:
   ```bash
   pnpm --filter @callscrapercrm/web typecheck
   ```

3. **Playwright smoke**:
   ```bash
   pnpm --filter @callscrapercrm/web test:e2e
   ```
   Asserts every nav leaf renders without console errors or 5xx.

## Commit style

Format per module: `module-<N>: <short title>` or `phase-<N>: <short title>`. Body explains the "why" with references to review findings when relevant. Keep each commit focused on one concern — if you find yourself writing "also, ..." more than twice, split the commit.

End every non-trivial commit message with:

```
Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

## Running a review cycle

The loop we use:

1. Write code + tsc + unit tests locally
2. Smoke test against the live Supabase project via the dev server
3. Launch an independent review agent (`Agent` → `general-purpose` with a brutal-reviewer prompt) to audit the diff
4. Address BLOCKERs + MAJORs from the review
5. Commit, update `PROGRESS.json`

The review transcripts are not checked in but findings feed into git commit messages so the rationale is captured.
