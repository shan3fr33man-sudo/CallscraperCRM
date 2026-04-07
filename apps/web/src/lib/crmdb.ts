/**
 * Browser/server client for our own CallscraperCRM Supabase project.
 * Uses the publishable anon key. v0 single-tenant has permissive RLS.
 */
import { createClient } from "@supabase/supabase-js";

export function crmClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";
