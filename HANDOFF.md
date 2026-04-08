# HANDOFF — Phase H complete. Project ready for pre-launch hardening.

## Current state
- All scaffolded phases A–H shipped on main. 8 Phase-H commits: H1..H8.
- tsc clean · vocab clean · href="#" zero · stub onClick zero.
- `ai_usage` and `call_coaching` tables exist on CRM and are empty (populate on first AI call / first cron run).

## What Phase H delivered
- **H1** `/api/ai/chat` extended with 7 river tools: `search_customers`, `get_customer_timeline`, `create_opportunity`, `create_task`, `list_overdue_tasks`, `send_template`, `get_pipeline_summary` (existing upstream tools preserved). Returns 402 with "Add your Anthropic API key in Settings → Integrations → API Keys" when `ANTHROPIC_API_KEY` is missing. Logs every request to `ai_usage` via `lib/ai-usage.ts` with sonnet-tier cost estimate.
- **H2** `AiSidebar` accepts `context: { page, record_type, record_id, record_name }`. `TopBar` auto-derives `page` from `usePathname()` and accepts an optional `aiContext` prop for deeper context. `/customers/[id]` passes `record_type=customer`, `record_id`, `record_name` so the system prompt references the customer by name.
- **H3** `POST /api/agents/draft-estimate` — reads opportunity + customer + most-recent call activity with summary data → Claude draft → strips code fences → parses JSON → computes totals → inserts into `estimates` with `tariff_snapshot={drafted_by:'ai',confidence,notes}` → emits `estimate.created`. Invalid JSON returns 422 with `raw`. Wired into `/customers/[id]` Estimate tab via `DraftEstimateButton` (confidence badge: high/medium/low).
- **H4** `lib/coaching-rubric.ts` — pure-TS `scoreCall()` classifier (zero LLM). Duration (20pts) + outcome (25pts) + lead_quality (20pts) + transcript keyword scoring (greeting/discovery/closing, 35pts) - negatives (hold/uncertainty/short transcript). Returns `{score, grade A-F, flags[], strengths[], improvements[]}`.
- **H5** `POST /api/agents/coach-calls` — finds uncoached `activities WHERE kind='call'` in last 25h (NOT IN call_coaching.call_id), runs `scoreCall()` on each, bulk inserts into `call_coaching` with `rubric_json={grade,flags,strengths,improvements}` and `coach_notes=improvements[0]`. Returns `{coached, avg_score, top_flag}`. `vercel.json` cron added: `"schedule": "0 8 * * *"`.
- **H6** `/sales/coaching` page + `/api/coaching` GET/PATCH route. Summary tiles (Avg Score, Calls Coached, Top Grade, Needs Attention), grade distribution bars (A=green … F=red), filter chips (grade + bucket), call table, click-row drawer (strengths + improvements + flag list with +/- points + transcript snippet + coach notes textarea + Mark Reviewed). PATCH route updates `coach_notes` and `reviewed_at`. Added `coaching` + `command-center` leaves under `sales` in `nav.ts`.
- **H7** `lib/ai-quick-actions.ts` — `QUICK_ACTIONS` keyed on page key (`sales.command-center`, `sales.new-leads`, `customers.detail`, `dispatch.command-center`, `customer-service.tickets`). `AiSidebar` renders up to 4 chips above the input when `messages.length===0 && !input`; clicking a chip auto-submits via `send(override)`.
- **H8** integration verification — all checks pass.

## Cost posture (enforced)
- AI features use workspace's own `ANTHROPIC_API_KEY` from `.env.local`. No shared key proxy.
- `ai_usage` logs tokens + cost on every chat + estimate_draft call.
- Background AI zero: `coach-calls` is pure-TS. Only user-initiated actions (chat, draft-estimate) call Claude.
- 402 on missing key with clear remediation message.

## Schema notes (locked)
- `activities` links to customer via `record_id` (NOT `customer_id`).
- `call_coaching.call_id` references `activities.id`. Cols: id, org_id, call_id, agent_ext, score, rubric_json, coach_notes, reviewed_by, reviewed_at, created_at.
- `ai_usage` cols: id, org_id, user_id, tool, tokens_in, tokens_out, cost_estimate, created_at (no `model`/`action` columns — use `tool` for action classification).
- `estimates` uses `amount` for total (NOT `estimated_total`). `tariff_snapshot` jsonb stores AI metadata.
- Event types emitted this phase: `opportunity.created`, `task.created`, `message.queued`, `estimate.created`.

## Runtime pendings (not blockers)
- First `/api/ai/chat` POST will populate `ai_usage` rows.
- First `/api/agents/coach-calls` POST (or nightly 8am UTC cron) will populate `call_coaching` rows.
- First `/api/sync/callscraper` POST (from Phase G) will populate `activities` so coaching has data to score.

## Pre-launch remaining (outside Phase H scope)
1. **Auth wall** — Supabase Auth with email+password or SSO. Replace `DEFAULT_ORG_ID` with session-scoped org. Enable real RLS on every table (currently `using (true)` for v0).
2. **Twilio wiring** — `POST /api/webhooks/twilio/voice` + `/recording` + `/sms` to replace the upstream callscraper sync for new workspaces. Keep callscraper sync for Shane's existing data.
3. **Stripe billing** — workspace plans + `integration_credentials` encrypted storage for `ANTHROPIC_API_KEY` + `TWILIO_*` + `RESEND_API_KEY`. Webhook `POST /api/webhooks/stripe` for subscription state.
4. **Real SMS/email providers** — Twilio SMS + Resend email dispatchers behind the `send_template` tool (currently queues to `sms_logs`/`email_logs` with `status='queued'`).
5. **Production deploy** — Vercel project, env var wiring, `vercel.json` crons verified, custom domain, Supabase connection pooler.
6. **Playwright smoke suite** — walk every nav leaf + click every button + verify 200s.
7. **First live sync trigger** — single manual `curl -X POST` against deployed `/api/sync/callscraper` to populate `activities` and `call_coaching` end-to-end.

## Gates (still green)
- `npx tsc --noEmit` — 0 errors
- `node scripts/check-vocab.ts` — clean
- `grep href="#"` — 0
- `grep onClick.*(TODO|stub|noop)` — 0
