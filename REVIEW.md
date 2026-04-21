# Code Review Guide for CallscraperCRM

This document is the **starting point** for an external reviewer (human or AI) auditing the CRM. It orients you to the architecture, calls out known-open defects we've deferred on purpose, and tells you where to look first.

Last updated: end of v1.1 Phase 3 + bulletproofing sprint (Modules 1–5).

---

## TL;DR — read these five things first

1. **This file** — architecture + review priorities
2. [`HANDOFF.md`](./HANDOFF.md) — how the system runs in production (cron, RLS, env)
3. [`docs/ROUTE_INVENTORY.md`](./docs/ROUTE_INVENTORY.md) — auto-generated table of every API route with mutation/scope/validation flags
4. [`packages/db/migrations/`](./packages/db/migrations/) in order (0001 → 0008). Migrations are the canonical schema — the `.ts` types follow.
5. [`apps/web/src/lib/automations.ts`](./apps/web/src/lib/automations.ts) — the event bus + automation engine that all state transitions flow through

---

## Architecture in one paragraph

Next.js 15 App Router app, Supabase Postgres backend. Every data-changing route mutates a table and emits a row to `events`. A cron-triggered worker (`/api/automations/run`, every 5 minutes) drains unprocessed events, matches them against enabled rules in `automations`, and executes actions (send_template, create_task, create_calendar_event, create_ticket, create_invoice, webhook). The estimate → sign → invoice → payment flow is fully wired: customer signs via a public HMAC-token-gated page → `estimate.accepted` event fires → `create_invoice` automation writes an invoice → a DB trigger recomputes the invoice rollup on every payment change. Tariff pricing is a pure-TS engine that runs in both the API route and the browser live-preview panel, reading from a first-class tariff schema (rates, tiers, modifiers, valuations, handicaps, assignments).

---

## Review priorities — where defects are most likely

### 1. Public endpoints with token-only auth

Only three API routes bypass the Supabase auth layer: `/api/estimates/[id]/view`, `/sign`, `/pdf` (the last has dual-path auth — session OR token). They're gated by an HMAC-signed token issued by `/send` and minted in `apps/web/src/lib/estimate-token.ts`.

**What to verify:**
- Secret rotation behaviour (`ESTIMATE_SIGNING_SECRET` env; dev fallback requires `ALLOW_DEV_SECRET=1`)
- Constant-time comparison on the signature
- Token length cap (DoS guard at 512 chars)
- Race guards on `/sign` (atomic accepted_at flip; orphan cleanup on failed signature insert)

**Known-open:**
- Token lifecycle on estimate amendment: `estimates.token_epoch` exists as a column but is not yet read by the verifier. An amended estimate's old-link signature is still honored. Add epoch to the signed payload when the amendment feature lands.
- 30-day expiry default may be too generous; `DEFAULT_EXPIRY_DAYS` in `estimate-token.ts` is now 14.

### 2. Multi-tenancy (`org_id` scoping)

Service-role Supabase client bypasses RLS, so app-layer `.eq("org_id", orgId)` is the primary defense. RLS with `get_my_org_id()` is belt-and-suspenders for non-service-role paths.

**What to verify:**
- Cross-reference `docs/ROUTE_INVENTORY.md` — any mutating route marked `⚠ missing` needs investigation. Some are cron/public endpoints (`/api/automations/run`, `/api/auth/*`) that intentionally run system-wide; others may be real gaps.
- Every INSERT on a multi-tenant table writes `org_id: orgId` from `getOrgId()`, not from the request body
- Cross-linked records (invoice referencing estimate, payment referencing invoice) check that the parent belongs to the same org

**Known-open:**
- `/api/calendar-events/[id]` shows as missing scope but its parent `GET /api/calendar-events` filters by org and writes cascade — verify the [id] PATCH/DELETE includes `.eq("org_id", orgId)`.

### 3. Automation idempotency

The `create_invoice` action and manual `/api/invoices/generate` route use:
- App-layer pre-check for existing invoice on the source (estimate_id or job_id)
- Deterministic invoice number (`INV-E<uuid8>` / `INV-J<uuid8>`)
- DB partial UNIQUE `(org_id, estimate_id)` and `(org_id, job_id)` on non-void invoices (migration 0008)
- Structured 23505 handling that distinguishes legit dedupe from number-space collision with a user-created invoice

**What to verify:**
- Two simultaneous calls never leave both branches succeeding (one should get 23505 and re-query)
- The 23505 re-query path is reachable (B1/B2 from Module 3 review fixed this)
- `invoice.created` events are never emitted twice for the same source

### 4. Payment rollup integrity

Migration 0006 + 0007 moved invoice balance computation from app code into a DB trigger (`trg_payments_recompute_{ins,del,upd}`). The trigger:
- Recomputes both OLD and NEW invoice when a payment's `invoice_id` is reassigned
- Preserves `overdue` status on partial payment when `due_date` has passed
- Never erases `paid_at` on refund (audit history preserved)
- Clamps balance at 0 (overpayments don't produce negatives; track separately if ever needed)

**What to verify:**
- Trigger correctness under concurrent inserts against the same invoice (single-row lock in PK order prevents deadlock)
- `WHEN (old IS DISTINCT FROM new)` clause on the UPDATE trigger — non-material column changes shouldn't refire
- Backfill in migration 0007 hits every invoice, not just ones with payments

### 5. Input validation at the API boundary

All tariff CRUD routes use Zod schemas from `@callscrapercrm/pricing/route-schemas`. Validation errors return 400 with field-level detail.

**What to verify:**
- Zod enum lists match the DB CHECK constraints in migration 0006 exactly (kind, unit, coverage_type, status, method, formula type, rounding_rule)
- `parseBody()` + `stripUndefined()` pattern — PATCH payloads don't null omitted columns
- Routes that still use `Record<string, unknown>` without Zod are tracked — if found, flag them

**Known-open:**
- Non-tariff mutating routes (`/api/opportunities`, `/api/calendar-events`, `/api/tasks`, etc.) still use ad-hoc defaults. Migration to zod schemas is deferred to Phase 5.

---

## Known-open defects (deferred, not oversight)

These were flagged by review but we chose to defer. A reviewer who surfaces them should see this list and match the rationale. Honest disclosure — if a real reviewer would find it in 30 minutes, it should be here.

### Pre-existing (predates the bulletproofing sprint, will be addressed in Phase 5)

| Finding | Where | Rationale |
|---|---|---|
| `/api/fields` POST/DELETE has no auth, no org scope, no validation | `apps/web/src/app/api/fields/route.ts` | Schema-extension API used only by an unbuilt admin UI; locked behind a feature flag in v1.2. Currently safe-by-obscurity (no UI invokes it). |
| `/api/auth/onboard` accepts arbitrary `user_id` from body | `apps/web/src/app/api/auth/onboard/route.ts` | Signup flow trusts the supabase session created by `/api/auth/callback` to set `user_id` from `auth.getUser()`. The body `user_id` field is legacy and slated for removal — verify the callback is the only caller. **Real bug if callable directly.** |
| `/api/webhooks/[plugin]` is a stub | `apps/web/src/app/api/webhooks/[plugin]/route.ts` | Returns `{ok: true}` with no signature verification or dispatch. Plugin webhook system lands in v1.2 with the integration adapter framework. |
| `/api/automations/run` has no shared-secret guard | `apps/web/src/app/api/automations/run/route.ts` | Cron-callable from anywhere — DoS vector for forcing automation drains. Vercel Cron headers (`x-vercel-cron`) provide weak protection in prod; add `CRON_SECRET` header check in v1.2. |
| `/api/messages/send` trusts `body.related_id` ownership | `apps/web/src/app/api/messages/send/route.ts` | Inserts `org_id: orgId` correctly but doesn't verify the `related_id` belongs to that org. A workspace user could attach a log row to an arbitrary id. Low blast radius (logs only). |
| `/api/agents/analyze-call`, `/api/sync/callscraper` lack `.eq("org_id")` | system/cron routes | Intentional — these run as the system across all orgs (sync, batch agent runs). They use `DEFAULT_ORG_ID` directly. Document via a comment in each file. |
| Email/SMS delivery is stub-only | `/api/estimates/[id]/send`, `/api/invoices/[id]/send` | Resend/Twilio adapters are Phase 4 work. `email_logs`/`sms_logs` capture intent; no actual send. |
| Non-tariff mutating routes lack Zod schemas | `/api/opportunities`, `/api/tasks` POST, etc. | Tracked; Phase 5 migrates every route to `parseBody`. The `[id]` PATCH routes were field-whitelisted in Module 5 to remove the mass-assignment surface. |

### From the v1.1 bulletproofing sprint (intentional tradeoffs)

| Finding | Where | Rationale |
|---|---|---|
| Token in URL query string appears in Referer / browser history | `apps/web/src/app/estimate/[id]/page.tsx` | Low-impact attack: requires attacker-controlled site + target re-clicking + 14-day expiry window. Swap to opaque cookie + `history.replaceState` in v1.2. |
| PDF route renders on every GET with no caching | `apps/web/src/app/api/estimates/[id]/pdf/route.ts` | Expected volume is low. Add Supabase Storage caching in v1.2 when the customer portal lands. |
| `token_epoch` column unused | `estimates.token_epoch` | Wired when the amendment feature lands (v1.2). |
| `label` null handling in UI editors | `apps/web/src/components/TariffRateEditor.tsx` | Cosmetic; React logs a warning but renders correctly. |
| Heuristic in `generate-route-inventory.ts` doesn't detect all auth patterns | `scripts/generate-route-inventory.ts` | Misses `tariffs!inner(org_id)` join-based ownership and `schema.parse()` (sync) validation. False positives in `⚠ missing` for `/api/tariffs/[id]/{modifiers,rates}/[childId]` routes — those rely on the inner-join ownership check, not direct org_id filter. |

---

## Review checklist (for Codex)

Copy and work through this list:

- [ ] **Auth boundary**: every route in `docs/ROUTE_INVENTORY.md` with `auth: public` is intentional (token-gated, webhook, cron, or genuinely public)
- [ ] **Scope**: every `⚠ missing` in the inventory is either (a) not multi-tenant, (b) cron/system-wide, or (c) a real bug to fix
- [ ] **Validation**: every mutating route either has `validated: ✓` or is explicitly exempted in the known-open list
- [ ] **Token module**: `estimate-token.ts` unit tests cover round-trip, tamper, expiry, version mismatch, DoS cap, secret rotation, dev-fallback gating
- [ ] **Trigger math**: migrations 0006 + 0007 + 0008 applied in order produce the same state as the source files
- [ ] **Automation idempotency**: double-calling `/api/invoices/generate` with the same estimate_id returns the same invoice id
- [ ] **Sign race**: concurrent POSTs to `/api/estimates/[id]/sign` result in exactly one signature row and exactly one `estimate.accepted` event
- [ ] **Copyright**: nothing in this codebase reproduces SmartMoving UI text verbatim. UI copy is original.

---

## Build / test / verify commands

```bash
pnpm install
pnpm --filter @callscrapercrm/web typecheck          # tsc --noEmit
pnpm --filter @callscrapercrm/web test:e2e           # Playwright smoke (33 public + app routes)
node --experimental-strip-types apps/web/src/lib/__tests__/estimate-token.test.ts  # HMAC token unit tests
node --experimental-strip-types scripts/generate-route-inventory.ts                 # regen docs/ROUTE_INVENTORY.md
pnpm --filter @callscrapercrm/web seed                # seed a demo org (idempotent)
```

Production build: `pnpm --filter @callscrapercrm/web build` (Next.js compilation — catches SSR/client boundary issues tsc alone misses).

---

## Where to push back

If a finding feels wrong or nitpicky, look at `PROGRESS.json` — we're in v1.1, not v1.0 stable. Tradeoffs we accept today:

- **Stateless HMAC over DB-backed magic links**: revocation is harder but we avoid a new table + scheduled cleanup. For 14-day estimate windows the tradeoff favors stateless.
- **Service-role client everywhere server-side**: RLS is a defense-in-depth layer, not the primary access control. App-layer `.eq("org_id", ...)` is the contract.
- **Zod schemas only on tariff CRUD**: rolling out to every route in a single pass was out of scope for the bulletproofing sprint; Phase 5 migrates the rest.
- **One shared `DEFAULT_ORG_ID` in dev**: multi-org login works in prod via `memberships.org_id`; single-org dev shortcut is an explicit choice in `getOrgId()` with fallback.

If you're writing a "you should really" finding that contradicts one of these, note it — we'd rather disagree explicitly than argue past each other.
