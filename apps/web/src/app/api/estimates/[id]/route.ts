import { NextResponse } from "next/server";
import { crmClient } from "@/lib/crmdb";
import { getOrgId } from "@/lib/auth";
import { emitEvent } from "@/lib/river";
import { parseBody } from "@/lib/validate";
import { updateEstimateSchema } from "@callscrapercrm/pricing";

export const runtime = "nodejs";

/**
 * GET /api/estimates/[id] — fetch a single estimate scoped to the caller's org.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = crmClient();
  const orgId = await getOrgId();
  const { data, error } = await sb
    .from("estimates")
    .select("*")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ estimate: data });
}

/**
 * PATCH /api/estimates/[id] — manual edit of an unsigned estimate.
 *
 * Allowed changes: charges_json, discounts, sales_tax (or tax_rate),
 * valid_until, estimate_type, deposit_amount, notes.
 *
 * Server-side recompute:
 *   subtotal = sum(charges_json[*].subtotal)
 *   amount   = max(0, subtotal - discounts + sales_tax)
 * The client does NOT get to set subtotal or amount directly — that would
 * let a manual edit desync from the line items. If `tax_rate` is provided
 * instead of `sales_tax`, we compute sales_tax = (subtotal - discounts) * tax_rate.
 *
 * Rejects edits on accepted estimates (409) — signed quotes are immutable
 * audit records; create a new estimate for a revision instead.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await parseBody(req, updateEstimateSchema);
  if (body instanceof Response) return body;

  const sb = crmClient();
  const orgId = await getOrgId();

  // Load current state so we can compute with missing fields and check status
  const { data: current, error: loadErr } = await sb
    .from("estimates")
    .select("id, org_id, accepted_at, declined_at, sent_at, subtotal, discounts, sales_tax, charges_json")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 });
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Immutable-after-signed (F5 review BLOCKER B1): once a customer has signed,
  // the amount is a contractual commitment and cannot be silently edited.
  if (current.accepted_at) {
    return NextResponse.json(
      {
        error: "This estimate has been signed and cannot be edited. Create a new estimate for a revision.",
        accepted_at: current.accepted_at,
      },
      { status: 409 },
    );
  }

  // Declined estimates likewise immutable — don't reopen them via edit. The
  // rep must explicitly duplicate into a new draft if they want to re-quote.
  if (current.declined_at) {
    return NextResponse.json(
      {
        error: "This estimate has been declined. Create a new estimate instead of editing this one.",
        declined_at: current.declined_at,
      },
      { status: 409 },
    );
  }

  // Mutually-exclusive tax inputs (F5 review M4): sales_tax and tax_rate
  // serve the same field; allowing both lets a client merge stale UI state
  // and get surprising precedence. Force the caller to pick one.
  if (body.sales_tax !== undefined && body.tax_rate !== undefined) {
    return NextResponse.json(
      { error: "Pass either sales_tax OR tax_rate, not both." },
      { status: 400 },
    );
  }

  // Build the patch. Start with safe fields (notes, valid_until, etc.) that
  // are allowed regardless of send state.
  const patch: Record<string, unknown> = {};
  if (body.valid_until !== undefined) patch.valid_until = body.valid_until;
  if (body.estimate_type !== undefined) patch.estimate_type = body.estimate_type;
  if (body.deposit_amount !== undefined) patch.deposit_amount = body.deposit_amount;
  if (body.notes !== undefined) patch.notes = body.notes;

  // Determine whether this edit touches money-affecting fields.
  const touchesMoney =
    body.charges_json !== undefined ||
    body.discounts !== undefined ||
    body.sales_tax !== undefined ||
    body.tax_rate !== undefined;

  // Immutable-after-sent for MONEY fields only (F5 review BLOCKER B1): the
  // customer already received this estimate via email/SMS. Mutating amounts
  // silently changes what they're signing without re-disclosure. Allow safe
  // field edits (notes, valid_until, deposit_amount) but block charge edits.
  if (touchesMoney && current.sent_at) {
    return NextResponse.json(
      {
        error:
          "This estimate has already been sent to the customer. Charge edits require a new revision — duplicate the estimate instead.",
        sent_at: current.sent_at,
      },
      { status: 409 },
    );
  }

  if (touchesMoney) {
    const nextLineItems =
      body.charges_json ??
      ((current.charges_json as Array<{ subtotal: number }> | null) ?? []);
    if (!Array.isArray(nextLineItems) || nextLineItems.length === 0) {
      return NextResponse.json(
        { error: "charges_json must have at least one line item" },
        { status: 400 },
      );
    }
    const subtotal = round2(
      nextLineItems.reduce((s, li) => s + Number(li.subtotal ?? 0), 0),
    );
    const discounts = round2(
      body.discounts ?? Number(current.discounts ?? 0),
    );
    let salesTax: number;
    if (body.sales_tax !== undefined) {
      salesTax = round2(body.sales_tax);
    } else if (body.tax_rate !== undefined) {
      salesTax = round2(Math.max(0, subtotal - discounts) * body.tax_rate);
    } else {
      salesTax = round2(Number(current.sales_tax ?? 0));
    }
    const amount = round2(Math.max(0, subtotal - discounts + salesTax));

    patch.charges_json = nextLineItems;
    patch.subtotal = subtotal;
    patch.discounts = discounts;
    patch.sales_tax = salesTax;
    patch.amount = amount;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data: updated, error: updErr } = await sb
    .from("estimates")
    .update(patch)
    .eq("id", id)
    .eq("org_id", orgId)
    .is("accepted_at", null) // race guard: refuse if someone signed mid-edit
    .select("*")
    .maybeSingle();
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
  if (!updated) {
    // Either disappeared or was signed between the check and the update
    return NextResponse.json(
      { error: "Estimate was signed or removed while you were editing. Refresh to see the latest." },
      { status: 409 },
    );
  }

  // Emit a river event so automations / audit logs see the edit
  await emitEvent(sb, {
    org_id: orgId,
    type: "estimate.updated",
    related_type: "estimate",
    related_id: id,
    payload: {
      estimate_id: id,
      opportunity_id: updated.opportunity_id,
      amount: updated.amount,
      fields_changed: Object.keys(patch),
    },
  });

  return NextResponse.json({ estimate: updated });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
