# Handoff — End of Phase F

## Status
Phase F complete. `tsc --noEmit` clean, vocab clean, zero `href="#"`, all form-target schemas verified against live Supabase via MCP.

## Phase F shipped
- **RecordForm.tsx** now supports 7 form kinds: `opportunity`, `lead`, `task`, `follow_up`, `estimate`, `crew_confirmation`, `ticket`
- **Field types**: `text`, `number`, `date`, `datetime`, `select`, `remote_select`, `textarea`, `phone`, `checkbox`, `customer_autocomplete` (new), `line_items` (new dynamic editor)
- **customer_autocomplete** — 300ms debounced search via `GET /api/customers?q=`, inline "+ Create new" mini-form, green selected chip with clear
- **LineItemsEditor** — dynamic list of rows (name/rate/qty → live subtotal), live total rollup under the grid
- **Validation** (F6): required, min_length, phone (10+ digits), number min/max, future-date for `due_at`. Field-level errors + top error banner that stays open on API failure (user keeps their data). `<fieldset disabled>` freezes inputs during submit.
- **Routing on success**: opp/lead → `/sales/new-leads`, task → `/tasks/open` or `/tasks/due-today`, follow_up → `/tasks/open`, ticket → `/customer-service/tickets/active`
- **Follow-up double-write**: POST `/api/tasks` then POST `/api/calendar-events` (kind=office, event_type=other, related_type=task). Step 2 logs error but never rolls back step 1.
- **Lead triage hook**: Lead form has "Run Lead Triage" checkbox; if checked and opp created, fire-and-forgets `POST /api/agents/analyze-call?lead_triage=true&opportunity_id=...`
- **Estimate**: computes subtotal → afterDiscount → tax → total live; POSTs `charges_json` + `estimated_total`; `Save & Send` checkbox triggers `POST /api/estimates/[id]/send` after create; event `estimate.created` emitted
- **Crew Confirmation**: creates a task with `type='crew_confirmation'` + optional SMS log via `/api/messages/send`
- **Ticket**: POSTs `{customer_id, job_id, ticket_name, type, priority:int, assigned_to, status:'active'}`; emits `ticket.opened`
- **NewMenu.tsx**: now 6 actions (Opportunity/Lead/Task/Follow-up/Estimate/Ticket). Global keyboard shortcuts: `N` opens menu, `O` → Opportunity, `T` → Task, `E` → Estimate
- **NewButton.tsx**: reusable page-level `+ New` button that opens RecordForm with `kind` and optional `prefill`. Wired into `/sales/new-leads`, `/sales/my-leads`, `/sales/follow-ups`, `/customers/opportunities`, `/customer-service/tickets/active`, `/tasks/open`

## API hardening
- `/api/customers` GET now accepts `?q=` (ILIKE on `customer_name` OR `customer_phone`, limit 10)
- `/api/opportunities` POST now persists `branch_id`, `assigned_to`, `origin_json`, `destination_json`
- `/api/estimates` POST now emits `estimate.created` + accepts `valid_until` (column `notes` dropped — doesn't exist in schema)
- `/api/tickets` POST already spreads body + emits `ticket.opened` (Phase E)
- `/api/crews` new GET (used by crew_confirmation remote_select)

## Vocab compliance
No new violations. All form submissions use `customer_name`, `customer_phone`, `assigned_to`, `status` (not `opp_status`), `amount` (not `estimated_value`), `quote_number`. Event types emitted: `opportunity.created`, `task.created`, `task.completed`, `estimate.created`, `ticket.opened`, `customer.created`, `message.queued`.

## Open caveats (v1.1 work)
- Live end-to-end smoke via dev server not executed — schemas verified by MCP instead. User should click-through all 7 forms after first boot and verify events row appears.
- Ticket form dropped the `description` textarea since `tickets` table has no `description` column. To capture notes, add an `activities` row post-create (future).
- `assigned_to` on ticket form is a free-text input (no remote_select) because `users_profiles.full_name` would trip vocab check. Needs a non-`full_name` user endpoint before converting to a dropdown.
- Form success-flash UX (200ms green) not implemented — form just closes. Low priority.
- Fields on opp form that the route *does* persist vs the route *drops*: all persisted now except `customer_name`/`customer_phone` which live on the related `customers` row (created inline by the autocomplete mini-form).

## Last commit
`phase-F7: smoke gates - schema verified (opps/tasks/estimates/tickets/events/calendar_events), priority int fix on tickets, drop notes col from estimates POST, opportunities POST now includes branch_id/assigned_to/origin_json/destination_json [tsc: clean]`

## Next: Phase G — Callscraper sync v2

Build `apps/worker/src/sync-callscraper-v2.ts`:

1. **sync_state table** — store last cursor (timestamp or id) per entity: `calls`, `call_summaries`, `opportunities`
2. **Delta sync** — cursor-based pagination from upstream (`earddtfueyboluglwbgt`) project: `WHERE updated_at > last_cursor ORDER BY updated_at LIMIT 500`, loop until empty
3. **Mirroring rules**:
   - calls → `activities` (kind='call', related_type='customer', customer matched by phone)
   - call_summaries → merge into `opportunities.lead_quality/intent/move_type/amount` (when attachable)
   - upstream opportunities → `opportunities` (idempotent via `upstream_id`)
4. **Conflict policy** — CRM user edits WIN; upstream only fills null fields after first edit marker
5. **Cron**: delta every 2m, full reconciliation every 60m
6. **Failure handling** — partial progress saved, retry picks up at cursor, dead-letter to `sync_errors` after 3 attempts
7. **Observability** — emit `sync.run.completed { entity, rows_upserted, duration_ms }` events
8. **Phone → customer matcher** — helper that normalizes phone and upserts a customer if none exists

Then Phase H: AI tools extension — every page gets an `/api/ai/chat` panel with tool calls for the current entity + coaching rubric per section.
