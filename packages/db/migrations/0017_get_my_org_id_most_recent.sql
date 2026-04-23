-- Multi-org users previously triggered non-deterministic RLS: the SQL helper
-- picked an arbitrary row from memberships while the JS API code was using
-- .maybeSingle() and silently failing on >1 rows. Ordering by created_at
-- makes both sides agree on "the most recent membership is the active one"
-- until an explicit active-org cookie exists.

CREATE OR REPLACE FUNCTION public.get_my_org_id()
  RETURNS uuid
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
  SELECT org_id
  FROM public.memberships
  WHERE user_id = auth.uid()
  ORDER BY created_at DESC
  LIMIT 1;
$function$;
