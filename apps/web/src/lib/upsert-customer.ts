import "server-only";
import { crmClient, DEFAULT_ORG_ID } from "./crmdb";
import { normalizePhone } from "./phone";

export async function upsertCustomer(
  phone: string | null | undefined,
  opts: {
    customer_name?: string | null;
    customer_email?: string | null;
    brand?: string | null;
    source?: string | null;
  } = {}
): Promise<{ id: string; created: boolean } | null> {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  const sb = crmClient();

  const existing = await sb
    .from("customers")
    .select("id")
    .eq("org_id", DEFAULT_ORG_ID)
    .eq("customer_phone", normalized)
    .limit(1)
    .maybeSingle();
  if (existing.data?.id) return { id: existing.data.id as string, created: false };

  const ins = await sb
    .from("customers")
    .insert({
      org_id: DEFAULT_ORG_ID,
      customer_phone: normalized,
      customer_name: opts.customer_name ?? "Unknown Caller",
      customer_email: opts.customer_email ?? null,
      brand: opts.brand ?? "APM",
      source: opts.source ?? "phone",
      status: "active",
    })
    .select("id")
    .single();

  if (ins.error) {
    const retry = await sb
      .from("customers")
      .select("id")
      .eq("org_id", DEFAULT_ORG_ID)
      .eq("customer_phone", normalized)
      .limit(1)
      .maybeSingle();
    if (retry.data?.id) return { id: retry.data.id as string, created: false };
    return null;
  }

  return { id: ins.data.id as string, created: true };
}
