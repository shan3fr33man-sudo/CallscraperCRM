# HANDOFF — Phase C complete

## State
- `apps/web/src/components/TopBar.tsx` — fully replaced. Renders breadcrumb (from `nav.ts` lookup on `usePathname()`), centered `<GlobalSearch />`, then right side: `<NewMenu />`, `<NotificationsBell />`, "Ask Claude" button (existing AiSidebar), `<UserMenu />`. Existing `<TopBar title="X" />` callsites still work — title prop overrides the breadcrumb.
- New components: `GlobalSearch.tsx`, `NewMenu.tsx`, `RecordForm.tsx`, `NotificationsBell.tsx`, `UserMenu.tsx`.
- `RecordForm` is a slide-in sheet, JSON-field-config driven, supports 4 kinds: `opportunity`, `lead`, `task`, `follow_up`. New Follow-up writes BOTH a `tasks` row AND a `calendar_events` row (kind=office, type=other) linked via related_type=task.
- `NewMenu` opens with keyboard shortcut `n`.
- `NotificationsBell` polls `/api/notifications` every 60s; shows unread badge, "Overdue Follow-up" pill, "Follow-up Due Today" pill, mark-all-read.
- New API routes:
  - `GET /api/search/global?q=` — parallel ilike on customers/opportunities/jobs/tasks, max 5/type, 20 total
  - `GET/PATCH /api/notifications` — list + counts + mark read
  - `POST/GET /api/tasks` — emits `task.created`
  - `POST/GET /api/calendar-events`
  - `GET /api/branches`, `GET /api/users`
- New pages: `/help`, `/login`, `/settings/integrations/import` (CSV upload stub)
- `nav.ts` leaves added: Settings→Company→Billing, Settings→Company→Notifications, Settings→Integrations→API Keys, Settings→Integrations→Import (existing dynamic catch-all `[section]/[[...rest]]` serves the placeholder pages for billing/notifications/api-keys; import has a real page).

## Gates
- `npx tsc --noEmit` in apps/web → 0 errors
- `node scripts/check-vocab.ts` → clean
- `grep -rn 'href="#"' apps/web/src` → 0 results
- Auth deferred: `/login` is a stub, `signOut()` redirects there

## Notes / deviations
- Windows case-insensitive FS forced everything into `TopBar.tsx` (not a separate `Topbar.tsx`). The exported symbol is still `TopBar` for backwards compat.
- Did not install shadcn — used raw Tailwind dropdowns/sheets to keep the dependency surface small. Phase D can install shadcn if FullCalendar styling needs it.
- `RecordForm` opportunity form posts customer first, then opportunity. Branch select loads from `/api/branches` (uses `select *`).

## Next session: Phase D — Calendar (Office + Job views)
1. `pnpm add @fullcalendar/react @fullcalendar/daygrid @fullcalendar/timegrid @fullcalendar/interaction` in apps/web
2. `apps/web/src/components/CalendarView.tsx` — reads `/api/calendar-events?kind={office|job}`, drag-to-reschedule fires PATCH (then `job.rescheduled` event)
3. New static routes:
   - `/calendars/office/page.tsx` (filters: Users, Type, Branch)
   - `/calendars/job/page.tsx` (filters: Branch, Job Type, Distance)
   - `/calendars/rate-overrides/page.tsx`
4. Wire FullCalendar event click → side panel with full record + activity timeline
5. Add 7am cron in `vercel.json` to emit `task.due_soon` events
