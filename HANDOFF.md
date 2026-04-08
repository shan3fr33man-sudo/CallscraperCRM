# HANDOFF — Phase B complete

## State
- River engine at `apps/web/src/lib/{events,automations}.ts` (moved from `packages/db/src` to pick up apps/web's `@supabase/supabase-js`).
- `apps/web/src/lib/river.ts` re-exports `emitEvent`, `runAutomations`, types.
- Cron entry: `apps/web/src/app/api/automations/run/route.ts` (POST + GET) → `runAutomations(sb, {limit: 200})`.
- `apps/web/vercel.json` cron `*/5 * * * *` for `/api/automations/run`.
- emitEvent wired into: `/api/customers`, `/api/opportunities`, `/api/estimates`, `/api/estimates/[id]/send`, `/api/estimates/[id]/accept`.
- 5 default automations seeded in Supabase `kxhqxrmroreuglvsatkn`, all `enabled = false`:
  1. opportunity.created → create_task (24h follow-up)
  2. estimate.sent → send_template SMS
  3. estimate.accepted → create_calendar_event(kind=job) + SMS + create_task "Assign crew"
  4. task.due_soon → SMS + Confirm crew task
  5. job.finished → email review request + Collect payment task
- E2E river verified via plpgsql emulation: 4 events processed, 3 automation_runs OK, 2 tasks, 1 calendar_event, 2 sms_logs, 1 job, opp status=booked. Test data cleaned; automations disabled again.

## Gates
- `npx tsc --noEmit` in apps/web → 0 errors
- `node scripts/check-vocab.ts` → clean
- Last commit: `69a8374` pushed to main

## Next session: Phase C (Topbar + global header)
1. Replace `apps/web/src/components/TopBar.tsx` with `Topbar.tsx`
2. Add components: `UserMenu.tsx`, `NewMenu.tsx`, `NotificationsBell.tsx`, `RecordForm.tsx`
3. New route `/api/search/global` querying customers, opportunities, jobs, tasks
4. New nav.ts leaves: Settings → Billing, Notifications, API Keys, Import
5. Notifications dropdown reads `notifications` table (already in Phase A schema)

## Notes / deviations
- Engine source moved from `packages/db/src/` → `apps/web/src/lib/`. `packages/db/src/` is now empty.
- E2E test was emulated in plpgsql; the cron route is the production driver and uses the same code path.
