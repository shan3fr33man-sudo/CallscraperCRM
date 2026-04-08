# HANDOFF — Phase A complete

## State
- Migration `packages/db/migrations/0002_river.sql` applied to Supabase project `kxhqxrmroreuglvsatkn` (callscrapercrm)
- 30 vertical tables created (customers, opportunities, estimates, jobs, calendar_events, tasks, tickets, claims, sms_logs, email_logs, templates, events, automations, automation_runs, notifications, users_profiles, crews, trucks, branches, tariffs + 6 tariff sub-tables, integration_credentials, sync_state, call_coaching, ai_usage)
- 4 branches seeded: APM (default), AFM, crewready, apex
- All tables RLS-enabled with "v0 anon all" policy (matches 0001 dev posture)
- `packages/shared-types/src/{enums,upstream,index}.ts` written with locked vocabulary + upstream row interfaces
- `scripts/check-vocab.ts` written (banned aliases CI gate)
- `PROGRESS.json` initialized at phase B

## Next session: Phase B (the river)
1. `packages/db/src/events.ts` — `emitEvent(client, org_id, type, payload, related_type?, related_id?)` helper
2. `apps/worker/src/automations.ts` — event loop:
   - Fetch events where `processed_at IS NULL`
   - For each, find matching enabled automations by `trigger == event.type`
   - Execute actions (send_template, create_task, create_calendar_event, set_status, assign_owner, create_ticket, webhook)
   - Insert `automation_runs` row, mark event processed
3. `/api/automations/run` route (Vercel cron entry, 5-min schedule)
4. Seed 5 default automations (DISABLED) via SQL or `/api/automations/seed`
5. E2E test: POST customer → events row → automation tick → automation_runs row

## Open TS errors
None — no new code wired into apps yet.

## Notes / deviations
- `intent` and `sentiment` columns on `opportunities` are free text (mirrors upstream — high cardinality, not enumable).
- `templates` already had a CHECK on channel; safe.
- `users_profiles.user_id` not FK to auth.users (single-org dev mode); add FK in v1.1 when auth lands.
