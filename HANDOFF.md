# HANDOFF — Phase D complete

## State
- FullCalendar installed: `@fullcalendar/{react,daygrid,timegrid,interaction,core}` v6.1.20.
- `apps/web/src/components/CalendarView.tsx` — dynamic-imported (`ssr: false`), renders week/day/month, drag-reschedule fires `PATCH /api/calendar-events/[id]`, eventClick opens `EventDetailDrawer`. Toast on success/revert.
- `apps/web/src/components/EventDetailDrawer.tsx` — slide-in sheet. Shows title/type/when/location/related link. Buttons: Reschedule (inline date pickers), Edit (same), Cancel Event (DELETE with confirm).
- `apps/web/src/app/api/calendar-events/route.ts` — GET extended with filters: `kind`, `branch_id`, `owner_id`, `event_type`, `start`, `end`. Returns FullCalendar shape `{id, title, start, end, allDay, color, extendedProps}`. Color seeded from event_type. POST emits `calendar_event.created`.
- `apps/web/src/app/api/calendar-events/[id]/route.ts` — PATCH (emits `job.rescheduled` if kind=job, else `calendar_event.updated`) and DELETE.
- Pages:
  - `/calendars/office` — Users + Branch + Type chip filters, "+ New Office Event" modal posts to `/api/calendar-events`.
  - `/calendars/job` — Branch + Job Type chips + Distance filter (job-type/distance are display-only until jobs table joins land in Phase E). No "+ New" — jobs created via estimate flow.
  - `/calendars/rate-overrides` — table of `tariff_modifiers` where `kind in (holiday|peak_season|weekend|other)`, "+ Add Override" modal POSTs `/api/rate-overrides` (auto-creates a default tariff if none exists).
- New API: `/api/rate-overrides` (GET/POST), `/api/tasks/scan-due` (GET/POST).
- `vercel.json` cron added: `/api/tasks/scan-due` daily at `0 14 * * *` (14:00 UTC = 7:00 AM Pacific). Emits `task.due_soon` for tasks due in next 24h.
- D9 verification: Phase B automation #3 (`estimate.accepted` → `create_calendar_event(kind=job)`) was already proven in the Phase B E2E test (1 calendar_event row). Cron-driven river writes the row when the automation is enabled.

## Gates
- `npx tsc --noEmit` in apps/web → 0 errors
- `node scripts/check-vocab.ts` → clean
- `grep href="#"` → 0 results
- Commits: `8ee15ca` (D1) → `8c8d60e` (D2) → `167a5c2` (D3+D4) → `5a9e511` (D5+D6+D7) → pending (D8)

## Notes / deviations
- FullCalendar wrapped in `next/dynamic({ssr:false})` to avoid SSR `window` errors.
- D7 rate overrides reuses `tariff_modifiers` table (Phase A schema) — workspace-level "Default Tariff" is auto-created on first POST.
- D8 cron also exposes a GET so it can be tested by hitting the URL directly.
- Office event_types color-coded: on_site_estimate #3B82F6, virtual_survey #8B5CF6, phone_survey #F59E0B, box_delivery #10B981, liveswitch_survey #EC4899, other #6B7280, move (job) #EF4444.

## Next session: Phase E — Per-section page backfill
1. Build `EntityTable.tsx` component (Supabase query + columns config + filter chips + drawer)
2. `/sales/new-leads` with opp columns (Status, Type, Service Date, Name, Branch, Address, Move Size, Source, Age)
3. `/customers/[id]` detail page with 7 tabs (Sales / Estimate / Storage / Files / Accounting / Profitability / Claims) and Activity sub-tabs (Note/Email/Call/Text)
4. `/dispatch/command-center` (flagship — Gantt by crew × time, drag-to-reassign)
5. `/sales/command-center` (flagship — live call feed, conversion funnel, leaderboard)
6. `/customer-service/tickets/{active,completed}`, `/dispatch/scheduling`, `/tasks/*` filtered views
