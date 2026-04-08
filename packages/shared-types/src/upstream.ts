// Upstream callscraper.com row shapes — generated from project earddtfueyboluglwbgt schema.
// Locked vocabulary: do not rename fields.

export interface UpstreamCall {
  id: string;
  ringcentral_id: string | null;
  company_id: string | null;
  date: string | null;
  from_number: string | null;
  to_number: string | null;
  duration: number | null;
  duration_seconds: number | null;
  direction: "inbound" | "outbound" | null;
  agent_ext: string | null;
  call_outcome: string | null;
  brand: string | null;
  notes: unknown;
  metadata: unknown;
  call_type: string | null;
  caller_name: string | null;
  status: string | null;
  started_at: string | null;
  ended_at: string | null;
  resolved_name: string | null;
  created_at: string;
}

export interface UpstreamCallSummary {
  id: string;
  call_id: string | null;
  company_id: string | null;
  model: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  call_summary: string | null;
  call_outcome: string | null;
  move_type: string | null;
  move_date: string | null;
  price_quoted: string | null;
  inventory_notes: string | null;
  lead_quality: string | null;
  key_details: unknown;
  transcript: string | null;
  transcript_source: string | null;
  summary: string | null;
  sentiment: string | null;
  intent: string | null;
  action_items: unknown;
  summary_was_scrubbed: boolean | null;
  scrubbed_at: string | null;
  created_at: string;
}

export interface UpstreamLead {
  id: string;
  call_id: string | null;
  company_id: string | null;
  brand: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  sm_customer_id: string | null;
  sm_data: unknown;
  uhl_data: unknown;
  created_at: string;
}

export interface UpstreamSmOpportunity {
  id: string;
  sm_id: string | null;
  quote_number: string | null;
  status: string | null;
  brand: string | null;
  branch: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  move_type: string | null;
  service_date: string | null;
  amount: number | null;
  sm_url: string | null;
  raw_data: unknown;
  synced_at: string | null;
  created_at: string;
}

export interface UpstreamSmCustomer {
  id: string;
  sm_id: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  phone2: string | null;
  brand: string | null;
  raw_data: unknown;
  synced_at: string | null;
  created_at: string;
}

export interface UpstreamPhoneDirectory {
  id: string;
  phone_e164: string | null;
  phone_digits: string | null;
  display_name: string | null;
  source: string | null;
  source_priority: number | null;
  sm_customer_id: string | null;
  sm_opportunity_id: string | null;
  brand: string | null;
  first_seen: string | null;
  last_seen: string | null;
  total_calls: number | null;
}

export interface UpstreamSmsLog {
  id: string;
  call_id: string | null;
  brand: string | null;
  to_number: string | null;
  from_number: string | null;
  message: string | null;
  status: string | null;
  sent_at: string | null;
}
