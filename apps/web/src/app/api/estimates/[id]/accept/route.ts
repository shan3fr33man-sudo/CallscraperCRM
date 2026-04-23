import { NextResponse } from "next/server";
import { crmClient } from "@/lib/crmdb";
import { requireOrgId } from "@/lib/auth";
import { emitEvent } from "@/lib/river";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  let orgId: string;
  try { orgId = await requireOrgId(); }
  catch (res) { if (res instanceof Response) return res; throw res; }
  const { id } = await params;
  const sb = crmClient();

  // Cross-tenant safety: scope the update to this org
  const { data: est, error: eErr } = await sb
    .from("estimates")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", orgId)
    .select("*, opportunities(id, customer_id, service_type, service_date, brand, customers(customer_name, customer_phone, customer_email))")
    .maybeSingle();
  if (eErr) return NextResponse.json({ error: eErr.message }, { status: 500 });
  if (!est) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const opp = (est as { opportunities?: Record<string, unknown> }).opportunities ?? {};
  const cust = (opp as { customers?: Record<string, unknown> }).customers ?? {};

  // Create the job row
  const { data: job, error: jErr } = await sb
    .from("jobs")
    .insert({
      org_id: orgId,
      opportunity_id: (opp as { id?: string }).id ?? est.opportunity_id,
      customer_id: (opp as { customer_id?: string }).customer_id ?? null,
      quote_number: null,
      customer_name: (cust as { customer_name?: string }).customer_name ?? null,
      service_type: (opp as { service_type?: string }).service_type ?? null,
      service_date: (opp as { service_date?: string }).service_date ?? null,
      status: "booked",
      amount: est.amount ?? 0,
    })
    .select("*")
    .single();
  if (jErr) return NextResponse.json({ error: jErr.message }, { status: 500 });

  // Set opportunity status to booked
  if ((opp as { id?: string }).id) {
    await sb.from("opportunities").update({ status: "booked" }).eq("id", (opp as { id: string }).id);
  }

  await emitEvent(sb, {
    org_id: orgId,
    type: "estimate.accepted",
    related_type: "estimate",
    related_id: id,
    payload: {
      estimate_id: id,
      opportunity_id: (opp as { id?: string }).id,
      job_id: job.id,
      customer_id: (opp as { customer_id?: string }).customer_id,
      customer_name: (cust as { customer_name?: string }).customer_name,
      customer_phone: (cust as { customer_phone?: string }).customer_phone,
      customer_email: (cust as { customer_email?: string }).customer_email,
      amount: est.amount,
      service_date: (opp as { service_date?: string }).service_date,
    },
  });

  await emitEvent(sb, {
    org_id: orgId,
    type: "job.booked",
    related_type: "job",
    related_id: job.id,
    payload: {
      job_id: job.id,
      customer_id: (opp as { customer_id?: string }).customer_id,
      service_date: (opp as { service_date?: string }).service_date,
    },
  });

  return NextResponse.json({ estimate: est, job });
}
