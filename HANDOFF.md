# Handoff — End of Phase E

## Status
Phase E complete. `next build` green, `tsc --noEmit` clean, vocab clean, zero `href="#"`.

## Phase E shipped
- `apps/web/src/components/EntityTable.tsx` — generic list view (filters/sort/pagination)
- `apps/web/src/components/OpportunityDrawer.tsx` — slide-in opp drawer with activity feed
- `/sales/new-leads`, `/sales/my-leads`, `/sales/follow-ups`
- `/sales/command-center` — live calls (left) + funnel (center) + leaderboard (right), 60s auto-refresh, reads `/api/calls/recent` from upstream callscraper
- `/dispatch/command-center` — today's jobs board, status strip, problem flags (no crew / no truck / unconfirmed), bulk Customer/Crew confirmation SMS, Advance status button
- `/dispatch/scheduling` — next 14 days
- `/customers/[id]` — 7-tab detail page (Sales / Estimate / Storage / Files / Accounting / Profitability / Claims) + activity feed (All/Note/Email/Call/Text), inline customer edit
- `/customers/opportunities` — all opportunities with status filter
- `/customer-service/tickets/active`, `/customer-service/tickets/completed`
- `/tasks/{open,due-today,overdue,completed}`
- `/accounting/jobs/[status]` — 4 status routes (pending-finalize / pending-close / closed / all)
- API routes: `/api/jobs`, `/api/jobs/[id]` (PATCH emits `job.<status>`), `/api/tickets`, `/api/tickets/[id]` (PATCH emits `ticket.closed` / `ticket.escalated`), `/api/activities`, `/api/claims` (POST emits `claim.opened`), `/api/customers/[id]`, `/api/calls/recent`, `/api/messages/send` (writes `sms_logs`, emits `message.queued`), `/api/tasks/[id]` (PATCH emits `task.completed`), `/api/opportunities` GET now accepts `?customer_id`

## Vocab compliance
All new code uses locked names: `customer_name`, `customer_phone`, `customer_email`, `assigned_to`, `status` (not `opp_status`), `amount`, `quote_number`. Event types emitted: `job.confirmed`, `job.en_route`, `job.finished`, `ticket.opened`, `ticket.closed`, `ticket.escalated`, `claim.opened`, `task.completed`, `message.queued`.

## Open caveats
- `/api/messages/send` is a stub — writes to `sms_logs` and emits but no provider wired (Twilio/Resend = v1.1)
- Tasks GET capped at 50 rows server-side; filtered client-side. Bump if needed.
- Dispatch command center "Advance" cycles statuses linearly; no skip/back
- Customer Files / Storage / Profitability tabs are placeholders (no upload/storage tables yet)
- `/sales/command-center` createOppFromCall does not link customer_id (no phone→customer lookup yet)

## Last commit
`phase-E6: tickets active/completed + dispatch/scheduling + tasks 4 views + customers/opportunities + accounting/jobs/[status] + tasks/[id] PATCH [tsc: clean]`

## Next: Phase F — "+ New" forms

Build slide-in `RecordForm` driven by JSON field config and wire 4 canonical forms:

1. **`apps/web/src/components/RecordForm.tsx`** — slide-in panel, fields: text/select/date/textarea/customer-autocomplete, validation, submit handler returns the created row id
2. **`apps/web/src/components/NewMenu.tsx`** — split-button dropdown in TopBar with 4 actions (Opportunity / Lead / Task / Follow-up); opens RecordForm with the right config
3. Field configs (4):
   - **New Opportunity**: customer (autocomplete or inline-create), service_type, service_date, move_size, branch, source, assigned_to, amount → POST `/api/opportunities`
   - **New Lead**: same shape but always `status='new'`; after create, optionally trigger Lead Triage agent
   - **New Task**: title, due_at, assigned_to, type, priority, related_type/related_id (optional) → POST `/api/tasks`
   - **New Follow-up**: shortcut for tasks with `type='follow_up'` AND auto-creates a `calendar_events` row (kind='office', event_type='other') at the same due time
4. Wire `NewMenu` into `TopBar.tsx` so it appears on every page
5. Smoke test: open each of the 4 forms, submit, confirm row appears in destination list page and `events` row was emitted

After Phase F: Phase G (callscraper sync v2) and Phase H (AI tools extension on `/api/ai/chat`).
