import { NextResponse } from "next/server";
import { crmClient } from "@/lib/crmdb";
import { emitEvent } from "@/lib/river";

export const runtime = "nodejs";

/**
 * POST /api/estimates/[id]/sign
 *
 * Public route — no auth (the signer is the customer). Body:
 *   { signer_name, signer_email?, signature_data (base64 PNG) }
 *
 * Inserts estimate_signatures row, sets accepted_at on estimate, emits
 * estimate.accepted event so the river fires (job creation, calendar, etc.).
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as {
    signer_name?: string;
    signer_email?: string;
    signature_data?: string;
  };

  if (!body.signer_name || !body.signature_data) {
    return NextResponse.json({ error: "signer_name and signature_data required" }, { status: 400 });
  }

  const sb = crmClient();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  // Insert signature
  const { data: sig, error: sigErr } = await sb
    .from("estimate_signatures")
    .insert({
      estimate_id: id,
      signer_name: body.signer_name,
      signer_email: body.signer_email ?? null,
      signature_data: body.signature_data,
      ip_address: ip,
    })
    .select("*")
    .single();
  if (sigErr) return NextResponse.json({ error: sigErr.message }, { status: 500 });

  // Mark estimate accepted
  const { data: est, error: estErr } = await sb
    .from("estimates")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", id)
    .select("*, opportunities(customer_id)")
    .single();
  if (estErr) return NextResponse.json({ error: estErr.message }, { status: 500 });

  await emitEvent(sb, {
    org_id: est.org_id,
    type: "estimate.accepted",
    related_type: "estimate",
    related_id: id,
    payload: {
      estimate_id: id,
      opportunity_id: est.opportunity_id,
      amount: est.amount,
      customer_id: (est as { opportunities?: { customer_id?: string } })?.opportunities?.customer_id,
      signer_name: body.signer_name,
      signature_id: sig.id,
    },
  });

  return NextResponse.json({ ok: true, signature: sig, estimate: est });
}
