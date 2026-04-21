# Active Blockers and Deferred Review Findings

Append-only log of issues surfaced during review that were deferred to avoid
derailing an in-flight module. Each entry is a reminder to address in a
follow-up commit or the next sprint — DO NOT close without a commit SHA
linking to the fix.

Format: `[status] [severity] [module] description — action`

## Open

### F1 review deferrals

- **open** MAJOR (F1) `SendEstimateDialog.tsx` — `delivery` booleans returned by
  `/api/estimates/[id]/send` mean "log row inserted" not "delivered". Current
  copy says "Queued for ... delivery" which is honest, and we added a muted
  explainer about the stub provider status. True delivery tracking requires
  real Resend/Twilio providers wired up.
  Action: wire Resend + Twilio adapters in a dedicated sprint (not this
  Phase 3.5). When they land, return per-channel status (`queued`, `sent`,
  `bounced`, `failed`) instead of booleans.

- **open** MINOR (F1) `SendEstimateDialog.tsx:81` — error surface is generic
  (`j.error ?? "Failed to send"`). The /send route returns only Supabase
  error messages on the estimate update path; no structured bad-email /
  bad-phone validation.
  Action: during D3, or when Resend wiring lands, add client-side recipient
  validation before POST (regex or zod email/E.164 phone) and return
  structured API errors for provider-level failures.

### F5 review deferrals

- **open** MAJOR (F5) PDF template assumes `quantity` and `rate` are truthy
  when rendering a line item. A manually-edited flat-rate line (label +
  subtotal only, no qty/rate) will render as "Qty: 1, Rate: $0.00" which
  looks buggy even though totals are correct.
  Action: in `apps/web/src/lib/pdf/estimate-template.tsx`, when a line item
  has no qty/rate, collapse those cells and give Description the extra
  width. Do the same for the customer-facing `/estimate/[id]` page and
  the invoice PDF in parallel.

- **open** MAJOR (F5) Rounding drift when a tariff-engine estimate used a
  non-default `rounding_rule` (e.g. `ceil_dollar`) and is later PATCHed
  manually. The PATCH route unconditionally re-rounds with `nearest_cent`
  which can shift a $2,001.00 estimate to $2,000.57 on save.
  Action: stamp the tariff's `rounding_rule` on the estimate row at
  creation time (new column), then reuse it on every recompute in the
  PATCH route. Alternatively, skip the recompute write when the computed
  totals match what's already on the row to the cent.

### F4 review deferrals

- **open** MAJOR (F4) `apps/web/src/app/api/payments/route.ts` — no idempotency
  on payments. A user double-clicking Record Payment in two tabs records two
  rows; the DB trigger rolls up correctly but the history shows two entries.
  PaymentRecorder has an in-component `submitting` guard (M3 review addressed
  single-tab double-click via `if (submitting || done) return`). Proper fix
  needs an idempotency key passed from client, stored via UNIQUE(invoice_id,
  idempotency_key).
  Action: add when Stripe webhooks land in Phase 4 — same idempotency
  infrastructure applies to card payments.

### Post-Codex direction-review concerns (to honor during remaining modules)

- **open** CONCERN (process) Review fatigue risk over 8 more modules
  Action: before invoking the review agent on each module, run the
  automated pre-check bundle: `tsc --noEmit` + `node scripts/check-vocab.ts`.
  Save agent cycles for semantic review only.

- **CLOSED** [4b510d0] CONCERN (I1) `organizations.upstream_company_id`
  schema decision. Migration 0009 ships nullable + non-unique with a
  partial index. Franchise-topology rationale documented in the migration
  comment + INTEGRATION.md.

- **CLOSED** [4764935] CONCERN (F4) Stripe seam preserved.
  PaymentRecorder ships with the "Card" pill disabled + Phase-4 tooltip;
  the payment-method enum still accepts "card". When Stripe lands the only
  change is removing the disabled flag and wiring StripePaymentForm.

- **CLOSED** [94ad517] CONCERN (F5) Extract `InlineEditableTable` primitive.
  Shipped at `apps/web/src/components/ui/InlineEditableTable.tsx` and
  consumed by `LineItemEditor`. Invoice line-item UI in F4 was scoped to
  read-only display; if/when invoice line-items become editable they can
  reuse the same primitive without changes.

- **open** CONCERN (tests) No Playwright smoke per F-module
  Action: add one Playwright smoke per F-module as it lands (create → click
  → verify DB state). Existing `apps/web/e2e/smoke.spec.ts` covers route
  200s but not flow-level assertions. Acceptable to retrofit at sprint end.

- **open** CONCERN (review debt) Keep this file live
  Action: every module's review cycle appends findings here if deferred.
  Sprint retrospective asserts none of the "open" entries is a real
  regression before the sprint is declared complete.

### F3 review deferrals (commit 7c0610c → next)

- **open** MAJOR (F3) `jobs` table has no `assigned_to` column, so the
  planned "Assigned-to dropdown" on the dispatch command center was omitted
  from F3. Adding it requires a migration + API whitelist update + UI control.
  Action: in the v1.1 follow-up or Phase 5, migrate `alter table jobs add
  column assigned_to uuid references users_profiles(user_id)`, add to
  ALLOWED_FIELDS on `/api/jobs/[id]`, and extend CrewPicker with an
  assignee select that reads from `/api/users`.

- **open** MAJOR (F3) Stale-data race: if dispatcher A opens the crew
  picker and dispatcher B advances the same job via `load()` triggered by
  a status change or poll, dispatcher A's in-progress edits silently
  overwrite B's change on save (last-write-wins). The `key={job.id}`
  mount pattern prevents stale DISPLAY but not the save conflict.
  Action: return updated crew_size/truck_ids from `/api/jobs/[id]` PATCH
  and compare against initial snapshot; if the server state drifted, show
  a "Job updated by another dispatcher — review and retry" banner. Add
  versioning (updated_at) for optimistic concurrency in a dedicated sprint.

- **open** MINOR (F3) `crew_size` has no DB CHECK constraint; client clamps
  to 0–20 but a forged request can set 99999.
  Action: in migration 0010, `alter table jobs add constraint
  jobs_crew_size_ck check (crew_size is null or (crew_size >= 0 and
  crew_size <= 50))`. Same pattern for any other numeric fields that take
  direct client input.

## Closed (historical, for reference)

_Entries move here with the commit SHA that addressed them._
