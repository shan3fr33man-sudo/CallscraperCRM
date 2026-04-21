import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { crmClient } from "@/lib/crmdb";
import { getOrgId } from "@/lib/auth";
import { InvoicePdf } from "@/lib/pdf/invoice-template";
import type { InvoicePdfProps } from "@/lib/pdf/invoice-template";
import { createElement } from "react";
import type { ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = crmClient();
  const orgId = await getOrgId();

  const { data: invoice, error } = await sb
    .from("invoices")
    .select("*, customers(customer_name, customer_phone, customer_email, address_json), opportunities(branch_id)")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (error || !invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  const cust = (invoice as { customers?: Record<string, unknown> }).customers ?? {};
  const branchId = (invoice as { opportunities?: { branch_id?: string } }).opportunities?.branch_id;

  let companyName = "Your Moving Company";
  let companyMeta: { address?: string; phone?: string; email?: string } = {};
  if (branchId) {
    const { data: b } = await sb.from("branches").select("name, address, phone").eq("id", branchId).maybeSingle();
    if (b) {
      companyName = (b.name as string) ?? companyName;
      companyMeta = { address: b.address as string, phone: b.phone as string };
    }
  }

  // Pull payments
  const { data: payments } = await sb
    .from("payments")
    .select("amount, method, reference, processed_at")
    .eq("invoice_id", id)
    .order("created_at", { ascending: true });

  const props: InvoicePdfProps = {
    company: { name: companyName, ...companyMeta },
    customer: {
      name: (cust.customer_name as string) ?? "Customer",
      phone: cust.customer_phone as string,
      email: cust.customer_email as string,
      address: ((cust.address_json as Record<string, unknown> | null)?.raw as string) ?? "",
    },
    invoice: {
      number: (invoice.invoice_number as string) ?? id.slice(0, 8).toUpperCase(),
      issued_at: (invoice.issued_at as string)?.slice(0, 10),
      due_date: invoice.due_date as string | null,
      line_items: ((invoice.line_items_json as Array<Record<string, unknown>> | null) ?? []).map((li) => ({
        label: (li.label as string) ?? "Item",
        rate: li.rate as number | undefined,
        quantity: li.quantity as number | undefined,
        unit: li.unit as string | undefined,
        subtotal: (li.subtotal as number) ?? 0,
      })),
      subtotal: (invoice.subtotal as number) ?? 0,
      discounts: (invoice.discounts as number) ?? 0,
      sales_tax: (invoice.sales_tax as number) ?? 0,
      amount_due: (invoice.amount_due as number) ?? 0,
      amount_paid: (invoice.amount_paid as number) ?? 0,
      balance: (invoice.balance as number) ?? 0,
      notes: (invoice.notes as string) ?? undefined,
    },
    payments: (payments ?? []).map((p) => ({
      amount: p.amount as number,
      method: p.method as string,
      reference: p.reference as string | null,
      processed_at: p.processed_at as string | null,
    })),
  };

  try {
    const element = createElement(InvoicePdf, props) as unknown as ReactElement<DocumentProps>;
    const buffer = await renderToBuffer(element);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="invoice-${props.invoice.number}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
