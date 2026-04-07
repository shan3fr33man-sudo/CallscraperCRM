import { NextResponse } from "next/server";
import callscraper from "../../../../../../../plugins/callscraper/src/index";
import { crmClient, DEFAULT_ORG_ID } from "@/lib/crmdb";

export const runtime = "nodejs";

/**
 * Manual sync trigger. Runs the callscraper plugin's direct adapter once
 * against our CRM Supabase. v0 uses the anon key (RLS is relaxed for single-tenant).
 */
export async function POST() {
  const sb = crmClient();
  const orgId = DEFAULT_ORG_ID;

  const objCache = new Map<string, string>();
  async function objId(key: string) {
    if (objCache.has(key)) return objCache.get(key)!;
    const { data } = await sb.from("objects").select("id").eq("org_id", orgId).eq("key", key).single();
    if (!data) throw new Error(`object ${key} missing`);
    objCache.set(key, data.id);
    return data.id;
  }

  const ctx = {
    orgId,
    config: {},
    secrets: {},
    log: (m: string) => console.log("[sync]", m),
    async upsertRecord(key: string, data: Record<string, unknown>) {
      const oid = await objId(key);
      const ext = data.external_id as string | undefined;
      if (ext) {
        const { data: existing } = await sb
          .from("records")
          .select("id")
          .eq("org_id", orgId)
          .eq("object_id", oid)
          .eq("data->>external_id", ext)
          .maybeSingle();
        if (existing) {
          await sb.from("records").update({ data, updated_at: new Date().toISOString() }).eq("id", existing.id);
          return { id: existing.id as string };
        }
      }
      const { data: row, error } = await sb
        .from("records")
        .insert({ org_id: orgId, object_id: oid, data })
        .select("id")
        .single();
      if (error) throw error;
      return { id: row!.id as string };
    },
  };

  try {
    const r = await callscraper.adapters.direct!.pull(ctx);
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
