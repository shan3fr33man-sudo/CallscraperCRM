import { NextResponse } from "next/server";
import callscraper from "../../../../../../../plugins/callscraper/src/index";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

/**
 * Manual sync trigger. Runs the callscraper plugin's direct adapter once
 * against our CRM Supabase. Requires SUPABASE_SERVICE_ROLE_KEY to bypass RLS.
 */
export async function POST() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY not set — add it to .env.local to enable mirroring." },
      { status: 400 },
    );
  }
  const sb = createClient(url, serviceKey, { auth: { persistSession: false } });
  const orgId = "00000000-0000-0000-0000-000000000001";

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
