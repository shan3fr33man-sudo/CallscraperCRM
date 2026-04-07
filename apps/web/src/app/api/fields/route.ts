import { NextResponse } from "next/server";
import { crmClient } from "@/lib/crmdb";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { object_id, key, label, type } = (await req.json()) as {
    object_id: string;
    key: string;
    label: string;
    type: string;
  };
  if (!object_id || !key || !label || !type)
    return NextResponse.json({ error: "object_id, key, label, type required" }, { status: 400 });
  const sb = crmClient();
  const { data, error } = await sb
    .from("fields")
    .insert({ object_id, key, label, type })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const sb = crmClient();
  const { error } = await sb.from("fields").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
