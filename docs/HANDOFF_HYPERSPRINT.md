# Handoff — Hyper-Sprint Deploy Session (2026-04-23)

Single-session summary. Read top-to-bottom to catch up in ~2 minutes.
If you're resuming this work, go straight to **§ Next actions** at the bottom.

---

## TL;DR — current state

- **✅ Phase 3.5 polish sprint** — 12 modules done, pushed to `main`.
- **✅ Integration Sprint** — M1 (TopBar embed), M3 (unified dashboard),
  M4 (auth bridge hardening + jti denylist + chooser), M5 (writeback
  endpoint) all landed + reviewed + patched. Earlier commits: `9bac45c`
  → `4964163` → `b6efd72` → `a59b201` → `4fd691f` → `04e7705` → `dafea42`
  → `8793696` → `40992a9`.
- **✅ Deployed to Vercel** — live at
  `https://callscrapercrm-live.vercel.app` via the direct REST API.
  Deploy ID `dpl_BsxQHzc7NrCswCyFRm3Es6yCfHcg` (from commit `40992a9`).
- **✅ Public CRM tour** at
  `https://shan3fr33man-sudo.github.io/CallscraperCRM/CRM_TOUR.html`
  (GitHub Pages).
- **✅ Test user created**: `info@aperfectmover.com` / `Sayon143$`
  (email confirmed, password set). User ID
  `619c90db-ab37-4787-b52e-57b32f600970`.

### 🚨 P0 UNFIXED — security leak

Codex review of the LIVE production URL (during this session) found that
**four API routes return prod PII without any auth**:

- `GET /api/customers`
- `GET /api/estimates`
- `GET /api/opportunities`
- `GET /api/tasks`

Root cause: they call `getOrgId()` which silently falls back to
`DEFAULT_ORG_ID` for unauthenticated requests. Fix pattern is documented
below.

**Do this before anything else.** See **§ P0 fix** below.

---

## What's live right now

| Item | URL / Value |
|---|---|
| Live app | `https://callscrapercrm-live.vercel.app` |
| Vercel project | `callscrapercrm-live` (id `prj_pDibijxp4Ie7wqkPvOuIxLMOsPfI`) |
| Vercel team | `shan3fr33man-sudos-projects` (id `team_WXDFUQadPk3XJeLjmg8zsYez`) |
| GitHub repo | `shan3fr33man-sudo/CallscraperCRM` (repo id `1204187245`) |
| Default branch | `main` |
| Last deployed commit | `40992a9` (as of session close) |
| Visual tour | `https://shan3fr33man-sudo.github.io/CallscraperCRM/CRM_TOUR.html` |
| Designer handoff | `docs/DESIGNER_HANDOFF.md` |

Two other Vercel projects exist from earlier misfires and should be
**deleted**: `callscrapercrm` and `callscraper-crm-web`. They're empty
and were created by the form-flow before I figured out the cron-limit
issue.

---

## Session secrets — where to find them

**DO NOT COMMIT THESE VALUES.** This repo is public.

| Secret | Where |
|---|---|
| `VERCEL_TOKEN` (Hobby, team-scoped, 30d) | Vercel → Account Settings → Tokens (`crm-auto-deploy`). Also set as GitHub Actions secret. |
| `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` | GitHub Actions secrets on the repo (set via `gh secret set`). |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard for project `kxhqxrmroreuglvsatkn`. Also in Vercel env for `callscrapercrm-live`. |
| `CALLSCRAPER_SUPABASE_SERVICE_KEY` | Same places. |
| `BRIDGE_SIGNING_SECRET` / `ESTIMATE_SIGNING_SECRET` | Generated fresh this session. In Vercel env + `DEPLOY.md` (redact before sharing). |

**Rotate** `VERCEL_TOKEN` and all Supabase service-role keys after the
P0 fix + first external demo. They were emitted into several agent
transcripts during this hyper-sprint.

---

## Key debugging finding — Vercel Hobby cron limit

The reason Deploy clicks kept creating projects with zero deployments:
`apps/web/vercel.json` had 4 crons running >1/day (every 5/15/20 min +
daily). Vercel Hobby plan rejects any deployment with a cron expression
that fires more than once per day, and the error surface is SILENT at
the UI level (the form just doesn't advance). It only showed up via
direct REST: `{"error":{"code":"cron_jobs_limits_reached",…}}`.

**Fix in commit `40992a9`**: `vercel.json` crons trimmed to strictly
daily (`0 8 * * *` callscraper sync, `0 14 * * *` task scan).

When the workspace upgrades to Pro, restore the original crons:
```json
{"path":"/api/sync/callscraper","schedule":"*/15 * * * *"},
{"path":"/api/agents/run-batch?limit=10&days=1","schedule":"*/20 * * * *"},
{"path":"/api/automations/run","schedule":"*/5 * * * *"},
{"path":"/api/tasks/scan-due","schedule":"0 14 * * *"}
```

---

## P0 fix — paste this on a fresh page

Four routes need `requireOrgId()` instead of `getOrgId()`. Pattern
already proven on `/api/dashboard/unified`:

```ts
import { requireOrgId } from "@/lib/auth";

export async function GET(req: Request) {
  let orgId: string;
  try { orgId = await requireOrgId(); }
  catch (res) { if (res instanceof Response) return res; throw res; }
  // existing query logic unchanged, keep using `orgId`
}
```

**Files to patch**:
- `apps/web/src/app/api/customers/route.ts` — GET handler
- `apps/web/src/app/api/estimates/route.ts` — GET handler
- `apps/web/src/app/api/opportunities/route.ts` — GET handler
- `apps/web/src/app/api/tasks/route.ts` — GET handler

**Also audit** POST/PATCH handlers in those files + `/api/activities`,
`/api/jobs`, `/api/invoices`, `/api/payments`, `/api/calendar-events`,
`/api/branches`, `/api/crews`, `/api/trucks`, `/api/tickets`,
`/api/claims`, `/api/messages` for the same pattern. Cron routes
(`/api/sync/*`, `/api/agents/*`, `/api/automations/run`) legitimately
use DEFAULT_ORG_ID and should be left alone.

Verify with:
```
pnpm -C "C:/Users/shane/OneDrive/Desktop/CallscraperCRM/apps/web" exec tsc --noEmit
```
must exit 0.

---

## Other Codex findings (MAJOR, not blocker)

- `X-Powered-By: Next.js` header present on all responses. Add
  `poweredByHeader: false` to `next.config.mjs`.
- `/launch?t=bogus` SSRs the full authed nav shell before client-side
  token validation runs. Should SSR a minimal error state. File:
  `apps/web/src/app/launch/page.tsx`. Same pattern on
  `/estimate/[id]?t=bogus`.

---

## In-flight work lost to mid-session tool errors

Three agents were launched right before this handoff but their outputs
were dropped by a tool-result-missing internal error. Results unknown
— rerun them on a fresh page:

1. **P0 security-fix agent** — may or may not have patched the 4
   routes. Easy: grep for `requireOrgId` in the 4 route files. If
   missing, fix per **§ P0 fix** above.
2. **Callscraper sync agent** — was supposed to hit
   `POST https://callscrapercrm-live.vercel.app/api/sync/callscraper?full=true`
   and verify row counts jumped in CRM Supabase. Just re-curl it.
3. **Automation + Resend wiring agent** — was supposed to (a) wire
   Resend into `/api/messages/send`, (b) insert 3 `templates` rows,
   (c) insert 3 `automations` rows for opportunity.created /
   estimate.sent / payment.received, (d) fire an end-to-end test that
   sends to `shan3fr33man@gmail.com`. Rerun cleanly.

---

## Test user setup

- Auth user `info@aperfectmover.com` (id `619c90db-ab37-4787-b52e-57b32f600970`).
  Password `Sayon143$` set. Email confirmed. ✓
- **Membership row** — also lost to the mid-session tool errors. Verify
  with:
  ```sql
  select * from memberships
  where user_id = '619c90db-ab37-4787-b52e-57b32f600970';
  ```
  If empty, insert one linking to `DEFAULT_ORG_ID`
  (`00000000-0000-0000-0000-000000000001`), role `owner`.
- Test email recipient for outbound SMS/email during QA:
  `shan3fr33man@gmail.com`.

---

## Important files modified this session (all committed + pushed)

- `apps/web/vercel.json` — crons trimmed for Hobby plan.
- `.github/workflows/deploy-vercel.yml` — new auto-deploy workflow.
- `apps/web/next.config.mjs` — `/embed/*` CSP + `/estimate/*` referrer
  policy headers (merged with prior D2 fix).
- `apps/web/src/app/api/tariffs/resolve/route.ts` — `requireOrgId`
  gate added (pattern reference).
- `apps/web/src/app/api/dashboard/unified/route.ts` — same.
- `apps/web/src/app/api/callscraper/writeback/route.ts` — writeback
  endpoint with `v1w.` HMAC prefix + UUID guard.
- `apps/web/src/lib/auth-bridge.ts` — `consumeJti` + writeback
  token support + three-prefix domain separation.
- `apps/web/src/app/launch/page.tsx` + `/launch/choose-org/page.tsx` —
  jti consumption + cookie handoff + multi-org chooser.
- `apps/web/src/app/embed/topbar/page.tsx` + `/embed/layout.tsx` —
  iframe-mountable TopBar for callscraper.com integration.
- `apps/web/src/lib/topbar-embed.ts` — postMessage bridge with origin
  allowlist.
- `apps/web/src/app/api/dashboard/unified/route.ts` +
  `UnifiedDashboardTiles.tsx` — 6-tile cross-product dashboard.
- `packages/db/migrations/0016_bridge_jti_denylist.sql` — applied to
  Supabase.
- `INTEGRATION.md` — writeback endpoint contract section added.
- `docs/CRM_TOUR.html` — 20-page visual mockup tour.
- `docs/DESIGNER_HANDOFF.md` — Ken's designer's spec.
- `DEPLOY.md` — one-click deploy guide (redact signing secrets before
  sharing).
- `PROGRESS.json` — updated to reflect Phase 3.5 complete.

---

## Next actions — in priority order

1. **Patch the 4 P0 routes** (§ P0 fix). Commit + push. Vercel
   auto-deploys.
2. **Re-run Codex review on production** to confirm all 4 routes now
   401 for unauthenticated callers.
3. **Rotate secrets** — Vercel token, both Supabase service-role
   keys. Update Vercel env + GitHub Actions secrets + local
   `.env.local`.
4. **Verify `memberships` row** exists for the test user. Insert if
   missing.
5. **Trigger first data sync** to production:
   `curl -X POST https://callscrapercrm-live.vercel.app/api/sync/callscraper?full=true`
   Expect ~13k activities / ~3k customers / ~5k opportunities.
6. **Wire Resend into `/api/messages/send`** — set `RESEND_API_KEY`
   in Vercel env, add the `TEST_EMAIL_OVERRIDE=shan3fr33man@gmail.com`
   env so all outbound test emails go to you.
7. **Seed 3 automations** (opportunity.created → welcome email,
   estimate.sent → notice, payment.received → thanks) and 3 matching
   templates. Fire one end-to-end to prove the river works on prod.
8. **End-to-end smoke** while signed in as `info@aperfectmover.com`:
   - Land on `/`, see unified dashboard.
   - Open `/customers/all-profiles`, click a row → detail page.
   - Send an estimate from the customer detail.
   - Open the customer-facing estimate link → sign → back in
     dispatch queue.
   - Generate invoice → record a $0.01 test payment → balance flips.
   - Check calendar: `/calendars/team` shows move date.
   - Check inbox (`shan3fr33man@gmail.com`) for the 3 automation
     emails.
9. **Second Codex review** on the full end-to-end + signed-in flows.
10. **Cleanup**: delete the `callscrapercrm` and `callscraper-crm-web`
    Vercel projects (empty, from earlier misfires).

---

## Quick-ref commands

```bash
# Deploy from REST
curl -s -X POST \
  "https://api.vercel.com/v13/deployments?teamId=$VERCEL_TEAM_ID&forceNew=1" \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"callscrapercrm-live","project":"callscrapercrm-live","target":"production","gitSource":{"type":"github","repoId":1204187245,"ref":"main"}}'

# Poll deployment state
curl -s -H "Authorization: Bearer $VERCEL_TOKEN" \
  "https://api.vercel.com/v13/deployments/$DEPLOY_ID?teamId=$VERCEL_TEAM_ID" \
  | python -c "import sys, json; print(json.load(sys.stdin).get('readyState'))"

# Trigger CRM sync from callscraper.com
curl -X POST https://callscrapercrm-live.vercel.app/api/sync/callscraper?full=true

# Verify data landed
curl -s -H "apikey: $SB_KEY" -H "Authorization: Bearer $SB_KEY" \
  "https://kxhqxrmroreuglvsatkn.supabase.co/rest/v1/customers?select=id&limit=1" \
  -I | grep -i content-range
```

---

**End of handoff.** Open a fresh chat with this file as the first
thing the new session reads. The next step is the P0 fix.
