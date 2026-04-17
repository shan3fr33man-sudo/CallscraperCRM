# CallscraperCRM — Day 1 Operations

Status: **GO** (Phases A–H + Launch L1–L6 complete)

## 1. Production URLs

- **App**: https://<your-vercel-domain> (set in Vercel project)
- **Supabase CRM**: https://kxhqxrmroreuglvsatkn.supabase.co
- **Supabase upstream (callscraper.com)**: https://earddtfueyboluglwbgt.supabase.co
- **Repo**: CallscraperCRM (this directory)

## 2. First-Time Setup (fresh Vercel project)

1. **Env vars** — copy `.env.production.example` into Vercel → Project Settings → Environment Variables. Required:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only, bypasses RLS for cron/onboard)
   - `CALLSCRAPER_SUPABASE_URL`
   - `CALLSCRAPER_SUPABASE_SERVICE_KEY`
   - `ANTHROPIC_API_KEY` (optional global fallback; per-workspace keys live in Settings → Integrations → API Keys)
2. **Deploy** — push `main`; Vercel builds automatically. Root is the repo root; `apps/web` is the Next.js app.
3. **Crons** — `vercel.json` declares 5 scheduled jobs. Confirm in Vercel → Project → Settings → Cron Jobs:
   - `/api/sync/callscraper` every 15 min
   - `/api/sync/callscraper?full=true` hourly
   - `/api/agents/coach-calls` daily 08:00 UTC
   - `/api/automations/run` every 5 min
   - `/api/tasks/scan-due` daily 14:00 UTC
4. **First workspace** — visit `/signup`, create email + password + workspace name. `/api/auth/onboard` creates the org + owner membership via service-role client.
5. **Per-workspace Anthropic key** — Settings → Integrations → API Keys → paste `sk-ant-...`. Recommended path; keeps Anthropic spend off the platform card.
6. **Run sync verification** — follow `SYNC_VERIFICATION.md` end to end.

## 3. Daily Operations

- **Home** `/` — dashboard tiles, leaderboard, open-items panel
- **Sales Command Center** `/sales/command-center` — live call feed from callscraper sync, conversion funnel, agent leaderboard
- **Dispatch Command Center** `/dispatch/command-center` — Gantt board (crew × time), bulk confirmations, status flags
- **Customers** `/customers`, `/customers/[id]` — 7 tabs: Sales, Estimate, Storage, Files, Accounting, Profitability, Claims
- **Calendars** `/calendars/office`, `/calendars/job`, `/calendars/rate-overrides`
- **Tasks** `/tasks/open`, `/tasks/due-today`, `/tasks/overdue`, `/tasks/completed`
- **Customer Service** `/customer-service/tickets/active`, `/customer-service/tickets/completed`
- **Settings** `/settings/integrations/api-keys`, `/settings/integrations/callscraper`, `/settings/integrations/import`, `/settings/objects`

## 4. What Each Launch Phase Delivered

- **L1 — Auth** — `@supabase/ssr` cookie client, `middleware.ts` redirects unauthenticated traffic to `/login`, `/login` and `/signup` pages, `/api/auth/callback` + `/api/auth/onboard`, `lib/auth.ts` with `getOrgId()` + `requireAuth()`. 30 user-facing API routes swapped from `DEFAULT_ORG_ID` to `await getOrgId()`.
- **L2 — RLS** — `public.get_my_org_id()` SECURITY DEFINER helper. `tenant_isolation` policy on 35 org-scoped tables. `memberships_self` + `organizations_self` policies break the circular dependency on memberships. `crmClient()` uses the service-role key server-side; application-layer `org_id = getOrgId()` scoping is the primary tenant fence, RLS is defense-in-depth.
- **L3 — Per-workspace API keys** — `integration_credentials(org_id, provider_key, secrets jsonb, enabled bool)`. Routes: `GET/POST/DELETE /api/settings/api-keys`. UI: `/settings/integrations/api-keys`. `ai/chat` route looks up the workspace's Anthropic key first, falls back to `process.env.ANTHROPIC_API_KEY`, returns 402 if neither exists.
- **L4 — Deploy prep** — `.env.production.example`, `vercel.json` with all 5 crons, production `next build` verified clean.
- **L5 — Sync verification** — `SYNC_VERIFICATION.md` covers the callscraper → CRM chain end to end.
- **L6 — Smoke tests** — `apps/web/playwright.config.ts` + `apps/web/e2e/smoke.spec.ts` walk all public + app routes asserting no 404/500. Run with `pnpm --filter @callscrapercrm/web test:e2e`.

## 5. Troubleshooting

**Login redirects in a loop** → middleware cookie setter failing. Check `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel.

**Empty customer list after sync** → check `sync_state` cursor advanced; check `/api/sync/callscraper` response in Vercel logs; confirm `CALLSCRAPER_SUPABASE_SERVICE_KEY` is set.

**"Add your Anthropic API key" (402)** → add key at Settings → Integrations → API Keys, or set `ANTHROPIC_API_KEY` env var as a global fallback.

**RLS "permission denied"** → user has no row in `memberships`. Re-run onboard via `POST /api/auth/onboard` with the user id, or insert manually:

```sql
INSERT INTO memberships (org_id, user_id, role)
VALUES ('<org-uuid>', '<user-uuid>', 'owner');
```

**Cron not firing** → confirm Vercel project is on a plan that supports cron jobs; check Vercel → Cron Jobs tab for last-run status.

## 6. What Remains (v1.1)

- **CallScraper REST API adapter** — typed client at `lib/callscraper-rest.ts` is ready to connect; Ken needs to build the `/api/v1/*` endpoints on callscraper.com. Store your API key at Settings → Integrations → API Keys (provider: callscraper) or set `CALLSCRAPER_API_KEY` env var. Test endpoint: `GET /api/sync/callscraper/test-rest`.
- Twilio voice + SMS webhook wiring (schema ready; adapter interface in `packages/integrations`)
- LiveSwitch + QuoteSheets video inventory adapters
- CSV import parser body (route scaffold exists at `/settings/integrations/import`)
- Real-time callscraper webhook path (cron covers v1)
- Drag-to-reschedule on resource calendar
- Stripe + Authorize.net payment adapters

## 7. Key Files Reference

- `apps/web/src/middleware.ts` — auth gate
- `apps/web/src/lib/auth.ts` — `getOrgId`, `requireAuth`
- `apps/web/src/lib/supabase/{server,client}.ts` — SSR clients
- `apps/web/src/lib/crmdb.ts` — service-role CRM client + `DEFAULT_ORG_ID`
- `apps/web/src/app/api/auth/{callback,onboard}/route.ts` — auth endpoints
- `apps/web/src/app/api/settings/api-keys/route.ts` — per-workspace key CRUD
- `vercel.json` — cron schedules
- `.env.production.example` — required env vars
- `apps/web/src/lib/callscraper-rest.ts` — REST API adapter (ready for when Ken's API launches)
- `apps/web/src/lib/sync-callscraper-v2.ts` — batch-optimized sync (calls, summaries, leads)
- `apps/web/src/lib/upsert-customer.ts` — customer upsert with batch support
- `SYNC_VERIFICATION.md` — post-deploy checklist
- `apps/web/e2e/smoke.spec.ts` — route smoke tests
