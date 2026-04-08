# HANDOFF — Phase G complete, Phase H next

## Last state
- Phase G shipped end-to-end. 8 commits on main: phase-G1..G8.
- tsc clean. Build gates green.
- Migration `phase_g_sync_state_ext` applied on CRM (`kxhqxrmroreuglvsatkn`).

## What Phase G delivered
- `apps/web/src/lib/phone.ts` — normalizePhone + phoneMatch (last-10 digits).
- `apps/web/src/lib/sync-state.ts` — getCursor / advanceCursor / markError / getStatus, keyed on (org_id, provider_key='callscraper', table_name). Defaults to EPOCH 2020-01-01.
- `apps/web/src/lib/upsert-customer.ts` — phone-dedup + inline create with safe defaults (brand='APM', source='phone', customer_name='Unknown Caller').
- `apps/web/src/lib/sync-callscraper-v2.ts` — syncCalls / syncCallSummaries / syncLeads / runFullSync. BATCH=500. Cursor on `created_at`. Dedupe activities via `payload->>external_id`. Opportunities via `upstream_id`. Emits `sync.run.completed`. Per-entity try/catch + markError. Hot/warm leads auto-create opportunities.
- `apps/web/src/app/api/sync/callscraper/route.ts` — POST runs runFullSync({fullReconcile:?full=true}); GET returns getStatus(). nodejs runtime, maxDuration 300.
- `vercel.json` — crons: 15m delta + hourly full reconcile.
- `apps/web/src/app/api/sync/status/route.ts` — GET returns sync_state + upstream counts.
- `apps/web/src/app/settings/integrations/callscraper/page.tsx` — Connection badge, 3 entity cards, Sync Now + Full Reconcile buttons, upstream counts panel.
- `apps/web/src/app/api/calls/recent/route.ts` — reads CRM `activities WHERE kind='call'` first, falls back to upstream if empty.
- `apps/web/src/app/sales/command-center/page.tsx` — leaderboard falls back to brand grouping until `assigned_to` is populated.

## Schema notes (locked)
- `sync_state`: composite unique `(org_id, provider_key, table_name)`. Columns: cursor, rows_synced, last_run_at, status, error.
- `activities`: record_id=customer_id, kind, payload jsonb. NO external_id column. Dedup via `payload->>external_id` (indexed).
- `opportunities.upstream_id` — used for lead idempotency.
- Upstream counts at sync time: calls=7330, summaries=3199, leads=3034.

## First runtime trigger (still pending)
Sync has never actually run. Code + schema verified, but no POST made yet. First run will populate sync_state rows and activities. Either curl the prod URL or wait for Vercel cron (15m after deploy).

## Phase H — next session
1. Extend `/api/ai/chat` with river tools (create_opportunity, create_task, book_job, move_opportunity_status, send_template, search_customers, get_customer_timeline, list_overdue_tasks). Workspace's own Anthropic key per zero-cost rule.
2. Build **Estimate Drafter** agent: opportunity → charges_json → human approve → emit `estimate.sent`.
3. Local coaching rubric (no LLM): regex+keyword+duration+outcome scoring. Table `call_coaching`. Nightly cron scores yesterday's calls.
4. `/sales/coaching` page — low-score queue, rubric scores, trend.
5. Per-section Claude sidebar context: feed current record + timeline into chat when opened from a detail page.

## Gates still green
- `npx tsc --noEmit` clean
- vocab clean; no `href="#"` in new files
- Every state mutation in sync-callscraper-v2 calls `emitEvent` once per entity
