# Sync verification — post-deploy checklist

Run these after the first production deploy to confirm the callscraper → CRM sync chain is healthy. All SQL runs against the CRM Supabase project `kxhqxrmroreuglvsatkn`.

## 1. Trigger a manual sync

```bash
curl -X POST https://<your-vercel-domain>/api/sync/callscraper
curl -X POST "https://<your-vercel-domain>/api/sync/callscraper?full=true"
```

Both should return 200 with a JSON summary (`{inserted, updated, cursor}`).

## 2. Confirm rows landed

```sql
-- customers upserted from upstream leads + calls
SELECT count(*) FROM customers;

-- call activities linked to customers
SELECT count(*) FROM activities WHERE kind = 'call';

-- opportunities created from leads
SELECT count(*) FROM opportunities;

-- sync cursor advanced
SELECT provider_key, cursor, last_run_at FROM sync_state ORDER BY last_run_at DESC;
```

Expected: non-zero rows in `customers`, `activities` (kind='call'), `opportunities`, and a recent `sync_state.last_run_at`.

## 3. Confirm the river fires

```sql
-- events emitted by the sync
SELECT type, count(*) FROM events GROUP BY type ORDER BY count DESC LIMIT 20;

-- automations processed the events
SELECT status, count(*) FROM automation_runs GROUP BY status;
```

Expected: `customer.created` and `opportunity.created` in events; automation_runs rows if any automations are enabled (they ship DISABLED by default — enable from `/settings/workflow/rules`).

## 4. Confirm idempotency

Run the manual sync a second time:

```bash
curl -X POST https://<your-vercel-domain>/api/sync/callscraper
```

Row counts should stay the same (no duplicates). The cursor should advance or remain (no regression).

## 5. Confirm crons are scheduled in Vercel

Vercel Dashboard → Project → Settings → Cron Jobs should list all 5:

- `/api/sync/callscraper` every 15m
- `/api/sync/callscraper?full=true` every hour
- `/api/agents/coach-calls` daily 08:00 UTC
- `/api/automations/run` every 5m
- `/api/tasks/scan-due` daily 14:00 UTC

## 6. Smoke the flagship pages

Open in browser (logged in):

- `/sales/command-center` — live call feed populated
- `/dispatch/command-center` — job Gantt board renders
- `/customers` — customer list shows upstream-synced rows
- `/sales/new-leads` — new-lead queue shows opportunities where status='new'

If any page is empty, check:
1. `memberships` table — does the logged-in user have a row for the default org?
2. RLS — can you `SELECT` as the authenticated user via the SQL editor with `SET LOCAL role authenticated`?
3. `get_my_org_id()` — does it return a non-null uuid for that user?
