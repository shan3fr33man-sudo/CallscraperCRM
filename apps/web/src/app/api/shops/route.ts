import { NextResponse } from "next/server";
import { crmClient } from "@/lib/crmdb";
import { getOrgId } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const sb = crmClient();
  const orgId = await getOrgId();
  const { data, error } = await sb
    .from("shops")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ shops: data ?? [] });
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    name?: string;
    address?: string;
    lat?: number;
    lng?: number;
  };
  if (!body.name || !body.address) {
    return NextResponse.json({ error: "name and address required" }, { status: 400 });
  }
  const sb = crmClient();
  const orgId = await getOrgId();
  const { data, error } = await sb
    .from("shops")
    .insert({
      org_id: orgId,
      name: body.name,
      address: body.address,
      lat: body.lat ?? null,
      lng: body.lng ?? null,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ shop: data });
}
