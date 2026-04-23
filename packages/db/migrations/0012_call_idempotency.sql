-- 0012: idempotency for CallScraper-driven estimate generation.
--
-- The estimator ingests calls via a Supabase-realtime subscriber on the
-- CallScraper v3 project's `call_summaries` table (see worker job
-- callscraper-subscriber.ts). The subscriber forwards each new row to this
-- CRM's /api/webhooks/callscraper. Realtime delivery is at-least-once:
-- reconnects and the polling reconciliation job can re-deliver the same
-- call. We key idempotency off CallScraper's stable `sessionId` (RingCentral
-- session id, unique per call).

alter table public.estimator_predictions
  add column if not exists source_call_id text;
create unique index if not exists uq_estimator_predictions_source_call_id
  on public.estimator_predictions (org_id, source_call_id)
  where source_call_id is not null;

-- Also store the source call id on the opportunity itself so dedupe can
-- happen before we even hit the estimator — if the opp already exists for
-- this call_id, skip and return the existing ids.
alter table public.opportunities
  add column if not exists source_call_id text;
create index if not exists idx_opportunities_source_call_id
  on public.opportunities (source_call_id) where source_call_id is not null;

comment on column public.estimator_predictions.source_call_id is
  'RingCentral sessionId from CallScraper v3. Used for at-least-once dedupe.';
comment on column public.opportunities.source_call_id is
  'RingCentral sessionId the opportunity originated from (if via CallScraper).';
