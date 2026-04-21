import { NextResponse } from "next/server";
import { crmClient } from "@/lib/crmdb";
import { emitEvent } from "@/lib/river";
import { assertEstimateToken } from "@/lib/estimate-token";

export const runtime = "nodejs";

/**
 * POST /api/estimates/[id]/sign?t=<token>
 *
 * Customer-facing signature submission. Authorization is the HMAC-signed
 * token issued by /api/estimates/[id]/send (or carried in the page URL
 * query param). Token must decode to this exact estimate id.
 *
 * Body: { signer_name, signer_email?, signature_data (base64 PNG) }
 *
 * Returns 401 if token is missing/invalid/expired, 409 if the estimate is
 * already signed (idempotency — only the first signature is recorded), 400
 * for missing fields. Inserts estimate_signatures, sets accepted_at, emits
 * estimate.accepted so the river fires (job creation, calendar, invoice).
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("t");
  if (!assertEstimateToken(token, id)) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 401 });
  }

  const body = (await req.json()) as {
    signer_name?: string;
    signer_email?: string;
    signature_data?: string;
  };

  if (!body.signer_name || !body.signature_data) {
    return NextResponse.json({ error: "signer_name and signature_data required" }, { status: 400 });
  }
  // Bounded inputs: prevent large-body DoS / DB bloat
  if (body.signer_name.length > 200) {
    return NextResponse.json({ error: "signer_name too long" }, { status: 400 });
  }
  if (body.signer_email && body.signer_email.length > 320) {
    return NextResponse.json({ error: "signer_email too long" }, { status: 400 });
  }
  if (body.signature_data.length > 2_000_000) {
    return NextResponse.json({ error: "signature_data too large" }, { status: 413 });
  }

  const sb = crmClient();

  // Look up the estimate up front so we have org_id for the signature row
  // and can pre-empt the obvious "not found" case.
  const { data: est } = await sb
    .from("estimates")
    .select("id, org_id, opportunity_id, amount, accepted_at")
    .eq("id", id)
    .maybeSingle();
  if (!est) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (est.accepted_at) {
    return NextResponse.json(
      { error: "Estimate already signed", accepted_at: est.accepted_at },
      { status: 409 },
    );
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  // Race-correct sequence: INSERT first, using the UNIQUE(estimate_id) index
  // on estimate_signatures (migration 0006) as the authoritative gate. Whoever
  // wins the unique-constraint race owns the signature. The accepted_at
  // flip below is then a downstream observation, not the gate — so a parallel
  // /sign request can never see "accepted but no signature row" (the previous
  // implementation had that TOCTOU window).
  const { data: sig, error: sigErr } = await sb
    .from("estimate_signatures")
    .insert({
      org_id: est.org_id,
      estimate_id: id,
      signer_name: body.signer_name,
      signer_email: body.signer_email ?? null,
      signature_data: body.signature_data,
      ip_address: ip,
    })
    .select("id")
    .single();
  if (sigErr) {
    if ((sigErr as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "Estimate already signed" }, { status: 409 });
    }
    return NextResponse.json({ error: sigErr.message }, { status: 500 });
  }

  // Flip accepted_at. Race-tolerant: if a parallel request also won an insert
  // (impossible — UNIQUE prevented it) or got here first, this UPDATE simply
  // matches no rows and returns null. We don't gate on the result.
  const acceptedAt = new Date().toISOString();
  await sb
    .from("estimates")
    .update({ accepted_at: acceptedAt })
    .eq("id", id)
    .is("accepted_at", null);

  // Customer_id lookup for the event payload (off the race-critical path)
  let customerId: string | null = null;
  if (est.opportunity_id) {
    const { data: opp } = await sb
      .from("opportunities")
      .select("customer_id")
      .eq("id", est.opportunity_id)
      .maybeSingle();
    customerId = (opp?.customer_id as string | null) ?? null;
  }

  await emitEvent(sb, {
    org_id: est.org_id,
    type: "estimate.accepted",
    related_type: "estimate",
    related_id: id,
    payload: {
      estimate_id: id,
      opportunity_id: est.opportunity_id,
      amount: est.amount,
      customer_id: customerId,
      signer_name: body.signer_name,
      signature_id: sig.id,
    },
  });

  return NextResponse.json({
    ok: true,
    signature: { id: sig.id },
    estimate: { ...est, accepted_at: acceptedAt },
  });
}
