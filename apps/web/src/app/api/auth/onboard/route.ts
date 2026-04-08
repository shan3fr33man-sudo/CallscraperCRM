import { createServiceSupabase } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { workspace_name, user_id } = await req.json();
    if (!workspace_name || !user_id) {
      return NextResponse.json({ error: "workspace_name and user_id required" }, { status: 400 });
    }

    const sb = createServiceSupabase();
    const slug =
      String(workspace_name)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 40) +
      "-" +
      Date.now().toString(36);

    const { data: org, error: orgErr } = await sb
      .from("organizations")
      .insert({ name: workspace_name, slug, plan: "free" })
      .select("id, slug")
      .single();

    if (orgErr || !org) {
      console.error("onboard: org insert failed", orgErr);
      return NextResponse.json({ error: orgErr?.message ?? "org creation failed" }, { status: 500 });
    }

    const { error: memErr } = await sb
      .from("memberships")
      .insert({ org_id: org.id, user_id, role: "owner" });

    if (memErr) {
      console.error("onboard: membership insert failed", memErr);
      return NextResponse.json({ error: memErr.message }, { status: 500 });
    }

    return NextResponse.json({ org_id: org.id, slug: org.slug });
  } catch (e) {
    console.error("onboard: exception", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
