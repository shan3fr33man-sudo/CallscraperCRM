/**
 * Server-side client for the upstream callscraper.com Supabase project.
 * Uses the service key — never import from client components.
 */
import "server-only";
import { createClient } from "@supabase/supabase-js";

export function callscraperClient() {
  const url = process.env.CALLSCRAPER_SUPABASE_URL;
  const key = process.env.CALLSCRAPER_SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("CALLSCRAPER_SUPABASE_URL/SERVICE_KEY not set");
  return createClient(url, key, { auth: { persistSession: false } });
}

export type Brand = "APM" | "AFM" | "crewready" | "apex" | "other";

export interface CallRow {
  id: string;
  ringcentral_id: string | null;
  date: string;
  from_number: string | null;
  to_number: string | null;
  duration_seconds: number | null;
  duration: number | null;
  direction: string | null;
  agent_ext: string | null;
  call_outcome: string | null;
  brand: Brand | null;
  caller_name: string | null;
  resolved_name: string | null;
  status: string | null;
  started_at: string | null;
  ended_at: string | null;
}

export interface CallSummaryRow {
  call_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  call_summary: string | null;
  summary: string | null;
  call_outcome: string | null;
  move_type: string | null;
  move_date: string | null;
  price_quoted: string | null;
  lead_quality: string | null;
  sentiment: string | null;
  intent: string | null;
  transcript: string | null;
  action_items: unknown;
}

export interface LeadRow {
  id: string;
  call_id: string | null;
  brand: Brand | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  created_at: string;
}
