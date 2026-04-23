/**
 * Server-only client for the CallscraperCRM Supabase project.
 * Uses the service-role key to bypass RLS — all user routes MUST scope queries
 * by `org_id = await getOrgId()` for tenant isolation. RLS remains enabled as
 * defense-in-depth.
 *
 * Earlier versions fell back to the anon key if the service-role env var was
 * missing. That path writes silently failed against RLS policies. We now throw
 * at startup in non-test environments so a misconfigured deploy surfaces the
 * problem immediately.
 */
import { createClient } from "@supabase/supabase-js";

export function crmClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("crmClient: NEXT_PUBLIC_SUPABASE_URL is not set");
  if (!key) {
    // Allow anon fallback only when explicitly opted in (test / local dev).
    if (process.env.ALLOW_ANON_CRM_CLIENT === "true") {
      const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!anon) throw new Error("crmClient: anon-fallback requested but NEXT_PUBLIC_SUPABASE_ANON_KEY is not set");
      return createClient(url, anon, { auth: { persistSession: false } });
    }
    throw new Error(
      "crmClient: SUPABASE_SERVICE_ROLE_KEY is required. Anon-key writes will fail RLS silently. Set SUPABASE_SERVICE_ROLE_KEY, or set ALLOW_ANON_CRM_CLIENT=true for local development.",
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";
