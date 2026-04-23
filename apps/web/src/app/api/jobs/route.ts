import { NextResponse } from "next/server";
import { crmClient } from "@/lib/crmdb";
import { requireOrgId } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  let orgId: string;
  try { orgId = await requireOrgId(); }
  catch (res) { if (res instanceof Response) return res; throw res; }
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const customerId = url.searchParams.get("customer_id");
  const date = url.searchParams.get("date");
  const branchId = url.searchParams.get("branch_id");
  const sb = crmClient();
  let q = sb.from("jobs").select("*").eq("org_id", orgId).order("service_date", { ascending: true }).limit(500);
  if (status && status !== "all") q = q.eq("status", status);
  if (customerId) q = q.eq("customer_id", customerId);
  if (date) q = q.eq("service_date", date);
  if (branchId) q = q.eq("branch_id", branchId);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ jobs: data ?? [] });
}
