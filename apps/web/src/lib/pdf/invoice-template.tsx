// React-PDF template for moving company invoice. Companion to estimate-template.tsx.

import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: "Helvetica", color: "#222" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
    borderBottom: "2px solid #333",
    paddingBottom: 8,
  },
  companyName: { fontSize: 18, fontWeight: 700, marginBottom: 4 },
  companyMeta: { fontSize: 9, color: "#666" },
  invoiceTitle: { fontSize: 22, fontWeight: 700, color: "#444" },
  invoiceNumber: { fontSize: 11, marginTop: 4 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 18 },
  block: { width: "48%" },
  blockLabel: {
    fontSize: 9,
    color: "#666",
    textTransform: "uppercase",
    marginBottom: 3,
    letterSpacing: 0.5,
  },
  blockText: { fontSize: 10, lineHeight: 1.4 },
  table: { borderTop: "1px solid #333", borderBottom: "1px solid #333", marginBottom: 12 },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f0f0f0",
    paddingVertical: 6,
    paddingHorizontal: 4,
    fontSize: 9,
    fontWeight: 700,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderTop: "0.5px solid #ddd",
  },
  colLabel: { flex: 4 },
  colQty: { flex: 1, textAlign: "right" },
  colRate: { flex: 1, textAlign: "right" },
  colSubtotal: { flex: 1.2, textAlign: "right" },
  totalsBlock: { alignSelf: "flex-end", width: "40%", marginTop: 4 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  amountDue: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    marginTop: 6,
    borderTop: "1px solid #333",
    borderBottom: "3px double #333",
    fontSize: 14,
    fontWeight: 700,
  },
  paymentSection: { marginTop: 24, padding: 12, border: "0.5px solid #ddd", borderRadius: 4 },
  paymentTitle: { fontSize: 10, fontWeight: 700, marginBottom: 6 },
  paymentRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  paymentText: { fontSize: 9, color: "#555" },
  termsSection: { marginTop: 16 },
  termsText: { fontSize: 9, lineHeight: 1.5, color: "#666" },
});

type LineItem = {
  label: string;
  rate?: number;
  quantity?: number;
  unit?: string;
  subtotal: number;
};

type Payment = {
  amount: number;
  method: string;
  reference?: string | null;
  processed_at?: string | null;
};

export interface InvoicePdfProps {
  company: { name: string; address?: string; phone?: string; email?: string };
  customer: { name: string; phone?: string; email?: string; address?: string };
  invoice: {
    number: string;
    issued_at?: string;
    due_date?: string | null;
    line_items: LineItem[];
    subtotal: number;
    discounts?: number;
    sales_tax?: number;
    amount_due: number;
    amount_paid: number;
    balance: number;
    notes?: string;
  };
  payments?: Payment[];
}

function fmt(n: number | undefined | null): string {
  return `$${(n ?? 0).toFixed(2)}`;
}

export function InvoicePdf({ company, customer, invoice, payments = [] }: InvoicePdfProps) {
  return (
    <Document title={`Invoice ${invoice.number}`}>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.companyName}>{company.name}</Text>
            {company.address ? <Text style={styles.companyMeta}>{company.address}</Text> : null}
            {company.phone ? <Text style={styles.companyMeta}>{company.phone}</Text> : null}
            {company.email ? <Text style={styles.companyMeta}>{company.email}</Text> : null}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.invoiceTitle}>INVOICE</Text>
            <Text style={styles.invoiceNumber}>#{invoice.number}</Text>
            {invoice.issued_at ? (
              <Text style={styles.companyMeta}>Issued: {invoice.issued_at}</Text>
            ) : null}
            {invoice.due_date ? (
              <Text style={styles.companyMeta}>Due: {invoice.due_date}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.block}>
            <Text style={styles.blockLabel}>Bill to</Text>
            <Text style={styles.blockText}>{customer.name}</Text>
            {customer.phone ? <Text style={styles.blockText}>{customer.phone}</Text> : null}
            {customer.email ? <Text style={styles.blockText}>{customer.email}</Text> : null}
            {customer.address ? <Text style={styles.blockText}>{customer.address}</Text> : null}
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.colLabel}>Description</Text>
            <Text style={styles.colQty}>Qty</Text>
            <Text style={styles.colRate}>Rate</Text>
            <Text style={styles.colSubtotal}>Amount</Text>
          </View>
          {invoice.line_items.map((li, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.colLabel}>{li.label}</Text>
              <Text style={styles.colQty}>
                {li.quantity ?? 1} {li.unit ?? ""}
              </Text>
              <Text style={styles.colRate}>{fmt(li.rate)}</Text>
              <Text style={styles.colSubtotal}>{fmt(li.subtotal)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totalsBlock}>
          <View style={styles.totalRow}>
            <Text>Subtotal</Text>
            <Text>{fmt(invoice.subtotal)}</Text>
          </View>
          {(invoice.discounts ?? 0) > 0 ? (
            <View style={styles.totalRow}>
              <Text>Discounts</Text>
              <Text>-{fmt(invoice.discounts)}</Text>
            </View>
          ) : null}
          {(invoice.sales_tax ?? 0) > 0 ? (
            <View style={styles.totalRow}>
              <Text>Sales tax</Text>
              <Text>{fmt(invoice.sales_tax)}</Text>
            </View>
          ) : null}
          <View style={styles.totalRow}>
            <Text>Total</Text>
            <Text>{fmt(invoice.amount_due)}</Text>
          </View>
          {invoice.amount_paid > 0 ? (
            <View style={styles.totalRow}>
              <Text>Paid</Text>
              <Text>-{fmt(invoice.amount_paid)}</Text>
            </View>
          ) : null}
          <View style={styles.amountDue}>
            <Text>Balance Due</Text>
            <Text>{fmt(invoice.balance)}</Text>
          </View>
        </View>

        {payments.length > 0 ? (
          <View style={styles.paymentSection}>
            <Text style={styles.paymentTitle}>Payment History</Text>
            {payments.map((p, i) => (
              <View key={i} style={styles.paymentRow}>
                <Text style={styles.paymentText}>
                  {p.processed_at?.slice(0, 10) ?? ""} — {p.method.toUpperCase()}
                  {p.reference ? ` (${p.reference})` : ""}
                </Text>
                <Text style={styles.paymentText}>{fmt(p.amount)}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.termsSection}>
          <Text style={styles.termsText}>
            {invoice.notes ?? "Thank you for your business."}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
