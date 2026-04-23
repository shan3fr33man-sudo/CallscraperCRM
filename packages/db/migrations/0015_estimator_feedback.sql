-- 0015 estimator_feedback: capture predicted-vs-final deltas on first send.
--
-- Background. Auto-generated estimates write line items based on historical
-- medians + the branch rate card. Agents then review, sometimes edit
-- (adjust hours, crew, add a stop, negotiate) before clicking Send. The
-- delta between what the estimator predicted and what actually went to the
-- customer is the training signal for tuning the predictor.
--
-- How it works.
--   1. When the webhook inserts an `estimator_predictions` row, it now
--      stamps `predicted_amount` (the subtotal we computed) so the trigger
--      below has a stable reference.
--   2. When an estimate transitions from unsent → sent (first time
--      `sent_at` flips from NULL to NOT NULL) AND the estimate was auto-
--      generated, the trigger copies the current amount/subtotal/charges
--      onto the prediction row and computes a signed delta.
--   3. `/settings/estimator` queries the aggregated deltas to surface
--      drift per brand × category × pricing_mode.
--
-- The trigger is AFTER UPDATE, defensive: it only acts on the first send
-- transition, so re-sends (Resend button) don't overwrite the original
-- feedback snapshot. If a subsequent edit matters, a later enhancement
-- can record additional feedback_events rows.

alter table public.estimator_predictions
  add column if not exists predicted_amount numeric,
  add column if not exists final_amount numeric,
  add column if not exists final_subtotal numeric,
  add column if not exists final_charges_json jsonb,
  add column if not exists final_captured_at timestamptz,
  add column if not exists edited_by_agent boolean not null default false,
  add column if not exists amount_delta_pct numeric;

-- Backfill predicted_amount for any existing rows (from prediction_json).
update public.estimator_predictions
set predicted_amount = coalesce(
  (
    select sum((item->>'total')::numeric)
    from jsonb_array_elements(prediction_json->'extra_line_items') as item
  ),
  0
)
where predicted_amount is null;

create or replace function public.capture_auto_estimate_feedback()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prediction_id uuid;
  v_predicted numeric;
  v_predicted_charges jsonb;
  v_edited boolean;
begin
  -- Only fire on the first-send transition for auto-generated estimates.
  if new.auto_generated is not true then
    return new;
  end if;
  if new.sent_at is null then
    return new;
  end if;
  if old.sent_at is not null then
    return new; -- already captured on the first send
  end if;

  select id, predicted_amount, prediction_json->'extra_line_items'
    into v_prediction_id, v_predicted, v_predicted_charges
  from public.estimator_predictions
  where estimate_id = new.id
  order by created_at desc
  limit 1;

  if v_prediction_id is null then
    return new; -- no prediction row, nothing to capture
  end if;

  -- Whether the agent materially edited the charges. jsonb `<>` operator is
  -- semantic (canonicalizes before compare), avoiding false positives from
  -- key-ordering or whitespace that `::text` comparison would create.
  v_edited := coalesce(v_predicted_charges, '[]'::jsonb) <> coalesce(new.charges_json, '[]'::jsonb);

  update public.estimator_predictions
  set
    final_amount = new.amount,
    final_subtotal = new.subtotal,
    final_charges_json = new.charges_json,
    final_captured_at = now(),
    edited_by_agent = v_edited,
    amount_delta_pct = case
      when coalesce(v_predicted, 0) > 0 then
        round(((new.amount - v_predicted) / v_predicted) * 100, 2)
      else null
    end
  where id = v_prediction_id;

  return new;
end;
$$;

drop trigger if exists tr_capture_auto_estimate_feedback on public.estimates;
create trigger tr_capture_auto_estimate_feedback
after update of sent_at on public.estimates
for each row
execute function public.capture_auto_estimate_feedback();

comment on column public.estimator_predictions.predicted_amount is
  'Subtotal the estimator predicted at call time. Stable reference for accuracy drift analysis.';
comment on column public.estimator_predictions.final_amount is
  'estimates.amount at first-send time. Populated by trigger tr_capture_auto_estimate_feedback.';
comment on column public.estimator_predictions.amount_delta_pct is
  '(final - predicted) / predicted × 100. Positive = agent charged MORE than prediction.';
