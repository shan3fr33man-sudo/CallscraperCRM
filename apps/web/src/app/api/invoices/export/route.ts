import { NextResponse } from "next/server";
import { crmClient } from "@/lib/crmdb";
import { requireOrgId } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * GET /api/invoices/export?format=csv&from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Streams invoices in QuickBooks-compatible CSV. Columns follow QuickBooks
 * Online's "Import invoices" CSV template (Customer, Invoice Date, Invoice No,
 * Due Date, Item, Amount, Memo).
 */
export async function GET(req: Request) {
  let orgId: string;
  try { orgId = await requireOrgId(); }
  catch (res) { if (res instanceof Response) return res; throw res; }
  const sb = crmClient();
  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") ?? "csv";
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  let q = sb
    .from("invoices")
    .select(
      "*, customers(customer_name, customer_email)",
    )
    .eq("org_id", orgId);
  if (from) q = q.gte("created_at", from);
  if (to) q = q.lte("created_at", to);

  const { data, error } = await q.order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (format !== "csv") {
    return NextResponse.json({ invoices: data ?? [] });
  }

  type InvoiceRow = {
    invoice_number: string;
    issued_at: string | null;
    created_at: string;
    due_date: string | null;
    line_items_json: Array<Record<string, unknown>> | null;
    amount_due: number;
    customers?: { customer_name?: string };
  };

  const headers = [
    "Customer",
    "Invoice Date",
    "Invoice No",
    "Due Date",
    "Item",
    "Description",
    "Quantity",
    "Rate",
    "Amount",
    "Memo",
  ];

  const escape = (s: unknown): string => {
    const str = String(s ?? "");
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows: string[] = [headers.join(",")];
  for (const inv of (data ?? []) as InvoiceRow[]) {
    const customerName = inv.customers?.customer_name ?? "Unknown Customer";
    const date = (inv.issued_at ?? inv.created_at)?.slice(0, 10);
    const lineItems = inv.line_items_json ?? [];

    if (lineItems.length === 0) {
      rows.push(
        [
          escape(customerName),
          escape(date),
          escape(inv.invoice_number),
          escape(inv.due_date ?? ""),
          escape("Move Services"),
          escape(""),
          escape(1),
          escape(inv.amount_due),
          escape(inv.amount_due),
          escape(""),
        ].join(","),
      );
    } else {
      for (const li of lineItems) {
        rows.push(
          [
            escape(customerName),
            escape(date),
            escape(inv.invoice_number),
            escape(inv.due_date ?? ""),
            escape((li.kind as string) ?? "Service"),
            escape((li.label as string) ?? ""),
            escape((li.quantity as number) ?? 1),
            escape((li.rate as number) ?? li.subtotal),
            escape((li.subtotal as number) ?? 0),
            escape(""),
          ].join(","),
        );
      }
    }
  }

  const csv = rows.join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="invoices-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
