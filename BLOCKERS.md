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

### Post-Codex direction-review concerns (to honor during remaining modules)

- **open** CONCERN (process) Review fatigue risk over 8 more modules
  Action: before invoking the review agent on each module, run the
  automated pre-check bundle: `tsc --noEmit` + `node scripts/check-vocab.ts`.
  Save agent cycles for semantic review only.

- **open** CONCERN (I1) `organizations.upstream_company_id` schema decision
  Action: when implementing migration 0009, make the column nullable and
  non-unique initially. Multi-workspace collisions across callscraper and
  CRM aren't resolved yet — locking in UNIQUE now forces a migration later
  if a single callscraper workspace wants to map to multiple CRM orgs (or
  vice versa). Document the lock-in decision in INTEGRATION.md.

- **open** CONCERN (F4) Stripe seam preservation
  Action: when generalizing `DepositCollector` → `PaymentRecorder` in F4,
  keep the `"card"` branch with a disabled "Card (Stripe) — configure in
  Settings" tooltip, not stripped. User said Stripe is LAST, not NEVER.
  The payment-method enum already accepts "card" per DB CHECK (migration
  0006) — don't regress.

- **open** CONCERN (F5) Extract `InlineEditableTable` primitive for F4 reuse
  Action: F4's invoice line items and F5's estimate line items share
  identical UI patterns (inline editable table, server recompute,
  optimistic update). Build the primitive once in F5 and reuse in F4 on
  follow-up pass — or if F5 lands before F4 needs its invoice line-item
  UI, retrofit F4 during code review.

- **open** CONCERN (tests) No Playwright smoke per F-module
  Action: add one Playwright smoke per F-module as it lands (create → click
  → verify DB state). Existing `apps/web/e2e/smoke.spec.ts` covers route
  200s but not flow-level assertions. Acceptable to retrofit at sprint end.

- **open** CONCERN (review debt) Keep this file live
  Action: every module's review cycle appends findings here if deferred.
  Sprint retrospective asserts none of the "open" entries is a real
  regression before the sprint is declared complete.

## Closed (historical, for reference)

_Entries move here with the commit SHA that addressed them._
