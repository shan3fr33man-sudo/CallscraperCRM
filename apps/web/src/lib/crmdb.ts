/**
 * Server-only client for the CallscraperCRM Supabase project.
 * Uses the service-role key to bypass RLS — all user routes MUST scope queries
 * by `org_id = await getOrgId()` for tenant isolation. RLS (L2) remains enabled
 * as defense-in-depth against any accidental anon-key access from outside.
 */
import { createClient } from "@supabase/supabase-js";

export function crmClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";
