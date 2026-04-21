import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { crmClient } from "@/lib/crmdb";
import { getOrgId } from "@/lib/auth";
import { EstimatePdf } from "@/lib/pdf/estimate-template";
import type { EstimatePdfProps } from "@/lib/pdf/estimate-template";
import { createElement } from "react";
import type { ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";

export const runtime = "nodejs";

/** GET /api/estimates/[id]/pdf — render estimate as PDF and stream it. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = crmClient();
  const orgId = await getOrgId();

  const { data: estimate, error } = await sb
    .from("estimates")
    .select("*")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (error || !estimate) {
    return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
  }

  // Pull related opportunity + customer + branch for the header
  let customer = { name: "Customer", phone: "", email: "", address: "" };
  let origin = "";
  let destination = "";
  let serviceDate: string | null = null;
  let companyName = "Your Moving Company";
  let companyMeta = { address: "", phone: "", email: "" };

  if (estimate.opportunity_id) {
    const { data: opp } = await sb
      .from("opportunities")
      .select("customer_id, branch_id, origin_json, destination_json, service_date")
      .eq("id", estimate.opportunity_id)
      .maybeSingle();
    if (opp) {
      serviceDate = (opp.service_date as string | null) ?? null;
      const oj = opp.origin_json as Record<string, unknown> | null;
      const dj = opp.destination_json as Record<string, unknown> | null;
      origin = (oj?.raw as string) ?? "";
      destination = (dj?.raw as string) ?? "";

      if (opp.customer_id) {
        const { data: cust } = await sb
          .from("customers")
          .select("customer_name, customer_phone, customer_email, address_json")
          .eq("id", opp.customer_id)
          .maybeSingle();
        if (cust) {
          customer = {
            name: (cust.customer_name as string) ?? "Customer",
            phone: (cust.customer_phone as string) ?? "",
            email: (cust.customer_email as string) ?? "",
            address: ((cust.address_json as Record<string, unknown> | null)?.raw as string) ?? "",
          };
        }
      }

      if (opp.branch_id) {
        const { data: branch } = await sb
          .from("branches")
          .select("name, address, phone")
          .eq("id", opp.branch_id)
          .maybeSingle();
        if (branch) {
          companyName = (branch.name as string) ?? companyName;
          companyMeta = {
            address: (branch.address as string) ?? "",
            phone: (branch.phone as string) ?? "",
            email: companyMeta.email,
          };
        }
      }
    }
  }

  const props: EstimatePdfProps = {
    company: { name: companyName, ...companyMeta },
    customer,
    estimate: {
      number: (estimate.estimate_number as string | null) ?? estimate.id.slice(0, 8).toUpperCase(),
      type: (estimate.estimate_type as string) ?? "non_binding",
      issued_at: (estimate.created_at as string)?.slice(0, 10),
      valid_until: estimate.valid_until as string | null,
      service_date: serviceDate,
      line_items: (estimate.charges_json as Array<Record<string, unknown>> | null)?.map((li) => ({
        label: (li.label as string) ?? "Item",
        kind: li.kind as string | undefined,
        rate: li.rate as number | undefined,
        quantity: li.quantity as number | undefined,
        unit: li.unit as string | undefined,
        subtotal: (li.subtotal as number) ?? 0,
      })) ?? [],
      subtotal: (estimate.subtotal as number) ?? 0,
      discounts: (estimate.discounts as number) ?? 0,
      sales_tax: (estimate.sales_tax as number) ?? 0,
      amount: (estimate.amount as number) ?? 0,
      deposit_amount: (estimate.deposit_amount as number) ?? 0,
    },
    origin,
    destination,
  };

  try {
    const element = createElement(EstimatePdf, props) as unknown as ReactElement<DocumentProps>;
    const buffer = await renderToBuffer(element);
    // Convert Node Buffer to Uint8Array for Response BodyInit compatibility
    const body = new Uint8Array(buffer);
    return new Response(body, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="estimate-${props.estimate.number}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
