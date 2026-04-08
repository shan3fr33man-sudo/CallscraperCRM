import { NextResponse } from "next/server";
import { crmClient } from "@/lib/crmdb";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";

const PROVIDERS = ["anthropic", "twilio", "resend"] as const;
type Provider = (typeof PROVIDERS)[number];

function validateKey(provider: Provider, key: string): string | null {
  if (!key || typeof key !== "string") return "Key required";
  if (provider === "anthropic" && !key.startsWith("sk-ant-")) return "Anthropic keys start with sk-ant-";
  if (provider === "twilio" && !key.startsWith("SK")) return "Twilio API Key SID starts with SK";
  if (provider === "resend" && !key.startsWith("re_")) return "Resend keys start with re_";
  return null;
}

function mask(key: string) {
  if (!key) return "";
  if (key.length <= 8) return "••••";
  return key.slice(0, 6) + "••••" + key.slice(-4);
}

export async function GET() {
  try {
    const { orgId } = await requireAuth();
    const sb = crmClient();
    const { data, error } = await sb
      .from("integration_credentials")
      .select("provider_key, secrets, enabled, created_at")
      .eq("org_id", orgId)
      .eq("enabled", true);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const rows = (data ?? []).map((r: { provider_key: string; secrets: { key?: string } | null; created_at: string }) => ({
      provider: r.provider_key,
      masked: mask(r.secrets?.key ?? ""),
      created_at: r.created_at,
    }));
    return NextResponse.json({ keys: rows });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { orgId } = await requireAuth();
    const { provider, key } = await req.json();
    if (!PROVIDERS.includes(provider)) {
      return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
    }
    const err = validateKey(provider, key);
    if (err) return NextResponse.json({ error: err }, { status: 400 });

    const sb = crmClient();
    const { error: upErr } = await sb
      .from("integration_credentials")
      .upsert(
        { org_id: orgId, provider_key: provider, secrets: { key }, enabled: true, config: {} },
        { onConflict: "org_id,provider_key" },
      );
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
    return NextResponse.json({ ok: true, provider, masked: mask(key) });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { orgId } = await requireAuth();
    const url = new URL(req.url);
    const provider = url.searchParams.get("provider");
    if (!provider || !PROVIDERS.includes(provider as Provider)) {
      return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
    }
    const sb = crmClient();
    const { error } = await sb
      .from("integration_credentials")
      .update({ enabled: false })
      .eq("org_id", orgId)
      .eq("provider_key", provider);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
