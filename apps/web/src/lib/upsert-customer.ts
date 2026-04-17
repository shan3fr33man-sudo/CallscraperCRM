import "server-only";
import { crmClient, DEFAULT_ORG_ID } from "./crmdb";
import { normalizePhone } from "./phone";

export type CustomerOpts = {
  customer_name?: string | null;
  customer_email?: string | null;
  brand?: string | null;
  source?: string | null;
};

export async function upsertCustomer(
  phone: string | null | undefined,
  opts: CustomerOpts = {}
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

/**
 * Batch-upsert customers by phone. Returns Map<normalizedPhone, customerId>.
 * Uses bulk SELECT + bulk INSERT for efficiency (2-3 queries vs N).
 */
export async function upsertCustomersBatch(
  entries: { phone: string | null | undefined; opts: CustomerOpts }[]
): Promise<Map<string, string>> {
  const sb = crmClient();
  const result = new Map<string, string>();

  // Normalize and deduplicate
  const uniquePhones = new Map<string, CustomerOpts>();
  for (const e of entries) {
    const norm = normalizePhone(e.phone);
    if (!norm) continue;
    if (!uniquePhones.has(norm)) uniquePhones.set(norm, e.opts);
  }
  if (uniquePhones.size === 0) return result;

  const phones = Array.from(uniquePhones.keys());

  // Batch lookup existing customers
  const { data: existing } = await sb
    .from("customers")
    .select("id, customer_phone")
    .eq("org_id", DEFAULT_ORG_ID)
    .in("customer_phone", phones);

  const existingMap = new Map<string, string>();
  for (const row of existing ?? []) {
    existingMap.set(row.customer_phone as string, row.id as string);
    result.set(row.customer_phone as string, row.id as string);
  }

  // Find phones that need inserting
  const toInsert = phones
    .filter((p) => !existingMap.has(p))
    .map((p) => {
      const opts = uniquePhones.get(p)!;
      return {
        org_id: DEFAULT_ORG_ID,
        customer_phone: p,
        customer_name: opts.customer_name ?? "Unknown Caller",
        customer_email: opts.customer_email ?? null,
        brand: opts.brand ?? "APM",
        source: opts.source ?? "phone",
        status: "active",
      };
    });

  if (toInsert.length > 0) {
    // Bulk insert, ignoring conflicts from race conditions
    const { data: inserted } = await sb
      .from("customers")
      .upsert(toInsert, { onConflict: "org_id,customer_phone", ignoreDuplicates: true })
      .select("id, customer_phone");

    for (const row of inserted ?? []) {
      result.set(row.customer_phone as string, row.id as string);
    }

    // For any that didn't return (conflict), re-fetch
    const missing = toInsert
      .map((r) => r.customer_phone)
      .filter((p) => !result.has(p));
    if (missing.length > 0) {
      const { data: refetched } = await sb
        .from("customers")
        .select("id, customer_phone")
        .eq("org_id", DEFAULT_ORG_ID)
        .in("customer_phone", missing);
      for (const row of refetched ?? []) {
        result.set(row.customer_phone as string, row.id as string);
      }
    }
  }

  return result;
}
