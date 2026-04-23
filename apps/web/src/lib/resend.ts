/**
 * Resend email transport.
 *
 * Lookup order for the API key:
 *   1. `RESEND_API_KEY` env var (preferred on Vercel)
 *   2. `integration_credentials.secrets.key` for provider_key='resend' (per-org)
 *
 * Test routing: if `TEST_EMAIL_OVERRIDE` is set, every outbound message is
 * rerouted to that address regardless of the caller-supplied `to`. The
 * original destination is appended to the body so we can see what would have
 * been sent in production.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface SendResult {
  ok: boolean;
  provider_id?: string;
  error?: string;
  skipped?: boolean;
}

export async function resolveResendKey(
  supabase: SupabaseClient | null,
  orgId: string | null,
): Promise<string | null> {
  const envKey = process.env.RESEND_API_KEY;
  if (envKey && envKey.length > 0) return envKey;
  if (!supabase || !orgId) return null;
  const { data } = await supabase
    .from("integration_credentials")
    .select("secrets")
    .eq("org_id", orgId)
    .eq("provider_key", "resend")
    .eq("enabled", true)
    .maybeSingle();
  const secrets = (data as { secrets?: { key?: string } } | null)?.secrets;
  return secrets?.key ?? null;
}

export async function sendEmail(args: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  body: string;
}): Promise<SendResult> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${args.apiKey}`,
    },
    body: JSON.stringify({
      from: args.from,
      to: args.to,
      subject: args.subject,
      text: args.body,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
  if (!res.ok) {
    return { ok: false, error: json.message ?? json.name ?? `HTTP ${res.status}` };
  }
  return { ok: true, provider_id: json.id };
}

export function applyTestOverride(to: string): { to: string; overridden: boolean; original?: string } {
  const override = process.env.TEST_EMAIL_OVERRIDE;
  if (!override) return { to, overridden: false };
  return { to: override, overridden: true, original: to };
}

export const DEFAULT_FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ?? "CallscraperCRM <onboarding@resend.dev>";
