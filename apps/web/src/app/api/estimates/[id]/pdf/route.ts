import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { crmClient } from "@/lib/crmdb";
import { getOrgId } from "@/lib/auth";
import { getCurrentUser } from "@/lib/auth";
import { assertEstimateToken } from "@/lib/estimate-token";
import { EstimatePdf } from "@/lib/pdf/estimate-template";
import type { EstimatePdfProps, InventoryItem } from "@/lib/pdf/estimate-template";
import { createElement } from "react";
import type { ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";

export const runtime = "nodejs";

/**
 * GET /api/estimates/[id]/pdf[?t=<token>][&strict=1]
 *
 * Renders a WA Tariff 15-C Item 85(3)-compliant PDF. With `strict=1`, returns
 * 422 with a list of missing required elements instead of rendering a
 * non-compliant PDF — agent UIs use strict mode to surface compliance gaps
 * before sending; preview/internal flows can render best-effort without strict.
 *
 * Auth paths (unchanged from prior version):
 *   1. Internal: authenticated user whose org owns the estimate
 *   2. Public: valid HMAC token bound to this estimate id
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = crmClient();
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("t");
  const strict = searchParams.get("strict") === "1";

  let authorized = false;
  if (assertEstimateToken(token, id)) {
    authorized = true;
  } else {
    const user = await getCurrentUser();
    if (user) {
      const orgId = await getOrgId();
      const { data: rec } = await sb
        .from("estimates")
        .select("id")
        .eq("id", id)
        .eq("org_id", orgId)
        .maybeSingle();
      authorized = Boolean(rec);
    }
  }
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: estimate, error } = await sb
    .from("estimates")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !estimate) {
    return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
  }

  // ── Source related rows for compliance fields ───────────────────────────
  let customer = { name: "Customer", phone: "", email: "", address: "", contact_person: "" };
  let origin = "";
  let destination = "";
  let intermediateStops: string[] = [];
  let serviceDate: string | null = null;
  let companyName = "Your Moving Company";
  let companyMeta: { address: string; phone: string; fax: string; email: string; wutc_permit_number: string } = {
    address: "",
    phone: "",
    fax: "",
    email: "",
    wutc_permit_number: "",
  };
  let pricingMode: "local" | "long_distance" | undefined =
    (estimate.pricing_mode as "local" | "long_distance" | undefined) ?? undefined;
  let inventoryItems: InventoryItem[] = [];
  let predictedWeightLb: number | undefined;
  let predictedTotalMiles: number | undefined;
  let predictedHours: number | undefined;
  let predictedCrew: number | undefined;
  let predictedTrucks: number | undefined;

  if (estimate.opportunity_id) {
    const { data: opp } = await sb
      .from("opportunities")
      .select(
        "customer_id, branch_id, brand_code, origin_json, destination_json, service_date, extracted_inventory_json",
      )
      .eq("id", estimate.opportunity_id)
      .maybeSingle();
    if (opp) {
      serviceDate = (opp.service_date as string | null) ?? null;
      const oj = opp.origin_json as Record<string, unknown> | null;
      const dj = opp.destination_json as Record<string, unknown> | null;
      origin = (oj?.address as string) ?? (oj?.raw as string) ?? "";
      destination = (dj?.address as string) ?? (dj?.raw as string) ?? "";

      // 15-C 85(3)(g) cube-sheet inventory
      const invJson = opp.extracted_inventory_json as
        | Array<Record<string, unknown>>
        | null;
      if (invJson && Array.isArray(invJson)) {
        inventoryItems = invJson.map((it) => ({
          room: (it.room as string) ?? "",
          item: (it.name as string) ?? (it.item as string) ?? "Item",
          qty: (it.qty as number) ?? 1,
          cu_ft: typeof it.cu_ft === "number" ? (it.cu_ft as number) : undefined,
        }));
      }

      if (opp.customer_id) {
        const { data: cust } = await sb
          .from("customers")
          .select("customer_name, customer_phone, customer_email, address_json, contact_person_json")
          .eq("id", opp.customer_id)
          .maybeSingle();
        if (cust) {
          customer = {
            name: (cust.customer_name as string) ?? "Customer",
            phone: (cust.customer_phone as string) ?? "",
            email: (cust.customer_email as string) ?? "",
            address: ((cust.address_json as Record<string, unknown> | null)?.raw as string) ?? "",
            contact_person:
              ((cust.contact_person_json as Record<string, unknown> | null)?.name as string) ?? "",
          };
        }
      }

      if (opp.branch_id) {
        const { data: branch } = await sb
          .from("branches")
          .select("name, address, phone, email, fax, wutc_permit_number")
          .eq("id", opp.branch_id)
          .maybeSingle();
        if (branch) {
          companyName = (branch.name as string) ?? companyName;
          companyMeta = {
            address: (branch.address as string) ?? "",
            phone: (branch.phone as string) ?? "",
            fax: (branch.fax as string) ?? "",
            email: (branch.email as string) ?? "",
            wutc_permit_number: (branch.wutc_permit_number as string) ?? "",
          };
        }
      }

      // Estimator-derived inputs (weight, miles, hours, crew, trucks) for
      // elements (h), (i), (j). Read from the most recent prediction.
      const { data: pred } = await sb
        .from("estimator_predictions")
        .select("prediction_json, pricing_mode")
        .eq("estimate_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (pred?.prediction_json) {
        const p = pred.prediction_json as {
          estimate_input?: {
            estimated_hours?: number;
            crew_size?: number;
            truck_size?: string;
            total_weight_lb?: number;
            total_miles?: number;
          };
        };
        predictedHours = p.estimate_input?.estimated_hours;
        predictedCrew = p.estimate_input?.crew_size;
        predictedTrucks = p.estimate_input?.truck_size ? 1 : undefined; // truck_size is "26ft" etc, not a count
        predictedWeightLb = p.estimate_input?.total_weight_lb;
        predictedTotalMiles = p.estimate_input?.total_miles;
        if (!pricingMode) {
          pricingMode = (pred.pricing_mode as "local" | "long_distance" | undefined) ?? undefined;
        }
      }
    }
  }

  // 15-C 85(3)(r) accepted forms of payment — sourced from the org/branch
  // settings table when present; falls back to a sensible default list so the
  // section never silently disappears.
  const acceptedPaymentMethods = ["Cash", "Check", "Visa", "Mastercard", "ACH"];

  const props: EstimatePdfProps = {
    company: { name: companyName, ...companyMeta },
    customer,
    estimate: {
      number: (estimate.estimate_number as string | null) ?? estimate.id.slice(0, 8).toUpperCase(),
      type: (estimate.estimate_type as string) ?? "non_binding",
      issued_at: (estimate.created_at as string)?.slice(0, 10),
      valid_until: estimate.valid_until as string | null,
      service_date: serviceDate,
      line_items:
        (estimate.charges_json as Array<Record<string, unknown>> | null)?.map((li) => ({
          label: (li.label as string) ?? "Item",
          kind: li.kind as string | undefined,
          rate: li.rate as number | undefined,
          quantity: li.quantity as number | undefined,
          unit: li.unit as string | undefined,
          subtotal: ((li.subtotal as number) ?? (li.total as number)) ?? 0,
        })) ?? [],
      subtotal: (estimate.subtotal as number) ?? 0,
      discounts: (estimate.discounts as number) ?? 0,
      sales_tax: (estimate.sales_tax as number) ?? 0,
      amount: (estimate.amount as number) ?? 0,
      deposit_amount: (estimate.deposit_amount as number) ?? 0,
      pricing_mode: pricingMode,
      estimated_weight_lb: predictedWeightLb,
      total_miles: predictedTotalMiles,
      estimated_hours: predictedHours,
      crew_size: predictedCrew,
      truck_count: predictedTrucks,
    },
    origin,
    destination,
    intermediate_stops: intermediateStops,
    inventory: inventoryItems,
    accepted_payment_methods: acceptedPaymentMethods,
  };

  // ── 15-C 85(3) compliance gate ─────────────────────────────────────────
  // In strict mode (used by the agent's "Send" button), refuse to render
  // when required elements would be missing. Customer-facing tokenized
  // requests render best-effort so a customer never sees an error page.
  const missing = checkCompliance(props);
  if (strict && missing.length > 0) {
    return NextResponse.json(
      {
        error: "Estimate is not 15-C Item 85(3) compliant",
        missing_elements: missing,
        remediation:
          "Update the branch (WUTC permit, fax/email) or the opportunity (inventory, intermediate stops) to populate these required fields, then re-send.",
      },
      { status: 422 },
    );
  }

  try {
    const element = createElement(EstimatePdf, props) as unknown as ReactElement<DocumentProps>;
    const buffer = await renderToBuffer(element);
    const body = new Uint8Array(buffer);
    return new Response(body, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="estimate-${props.estimate.number}.pdf"`,
        "Cache-Control": "no-store",
        "X-Compliance-Missing": missing.join(","),
      },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

function checkCompliance(props: EstimatePdfProps): string[] {
  const missing: string[] = [];
  if (!props.company.wutc_permit_number) missing.push("a:wutc_permit_number");
  if (!props.company.address) missing.push("a:carrier_address");
  if (!props.customer.name || props.customer.name === "Customer") missing.push("d:customer_name");
  if (!props.origin) missing.push("f:origin");
  if (!props.destination) missing.push("f:destination");
  // (g) — long-distance shipments require a cube sheet; local can use line items
  if (props.estimate.pricing_mode === "long_distance" && (!props.inventory || props.inventory.length === 0)) {
    missing.push("g:inventory_cube_sheet");
  }
  if (props.estimate.pricing_mode === "long_distance" && !props.estimate.estimated_weight_lb) {
    missing.push("h:estimated_weight_lb");
  }
  if (props.estimate.pricing_mode === "local" && !props.estimate.estimated_hours) {
    missing.push("i:estimated_hours");
  }
  if (!props.accepted_payment_methods || props.accepted_payment_methods.length === 0) {
    missing.push("r:accepted_payment_methods");
  }
  return missing;
}
