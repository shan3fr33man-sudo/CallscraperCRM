import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/supabase";

export async function GET() {
  const sb = await serverSupabase();
  const { data, error } = await sb.from("records").select("*").limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(req: Request) {
  const body = await req.json();
  const sb = await serverSupabase();
  const { data, error } = await sb.from("records").insert({ data: body }).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
