// React-PDF template for moving estimate. Renders deterministically server-side
// from row data; consumed by /api/estimates/[id]/pdf and the email send flow.

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: "Helvetica", color: "#222" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24, borderBottom: "2px solid #333", paddingBottom: 8 },
  companyBlock: { flexDirection: "column" },
  companyName: { fontSize: 18, fontWeight: 700, marginBottom: 4 },
  companyMeta: { fontSize: 9, color: "#666" },
  estimateBlock: { flexDirection: "column", textAlign: "right" },
  estimateTitle: { fontSize: 22, fontWeight: 700, color: "#444" },
  estimateNumber: { fontSize: 11, marginTop: 4 },
  customerSection: { flexDirection: "row", justifyContent: "space-between", marginBottom: 18 },
  customerBlock: { width: "48%" },
  blockLabel: { fontSize: 9, color: "#666", textTransform: "uppercase", marginBottom: 3, letterSpacing: 0.5 },
  blockText: { fontSize: 10, lineHeight: 1.4 },
  table: { borderTop: "1px solid #333", borderBottom: "1px solid #333", marginBottom: 12 },
  tableHeader: { flexDirection: "row", backgroundColor: "#f0f0f0", paddingVertical: 6, paddingHorizontal: 4, fontSize: 9, fontWeight: 700 },
  tableRow: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 4, borderTop: "0.5px solid #ddd" },
  colLabel: { flex: 4 },
  colQty: { flex: 1, textAlign: "right" },
  colRate: { flex: 1, textAlign: "right" },
  colSubtotal: { flex: 1.2, textAlign: "right" },
  totalsBlock: { alignSelf: "flex-end", width: "40%", marginTop: 4 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  totalLabel: { fontSize: 10 },
  totalValue: { fontSize: 10, textAlign: "right" },
  grandTotal: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, marginTop: 4, borderTop: "1px solid #333", fontSize: 13, fontWeight: 700 },
  badge: { fontSize: 9, color: "#fff", backgroundColor: "#444", paddingVertical: 2, paddingHorizontal: 6, borderRadius: 2, alignSelf: "flex-start", marginBottom: 8 },
  termsSection: { marginTop: 24, paddingTop: 12, borderTop: "0.5px solid #ddd" },
  termsTitle: { fontSize: 10, fontWeight: 700, marginBottom: 6 },
  termsText: { fontSize: 9, lineHeight: 1.5, color: "#555" },
  signatureRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 30 },
  signatureBlock: { width: "45%" },
  signatureLine: { borderBottom: "1px solid #333", height: 30, marginBottom: 4 },
  signatureLabel: { fontSize: 9, color: "#666" },
});

type LineItem = {
  label: string;
  kind?: string;
  rate?: number;
  quantity?: number;
  unit?: string;
  subtotal: number;
};

export interface EstimatePdfProps {
  company: {
    name: string;
    address?: string;
    phone?: string;
    email?: string;
  };
  customer: {
    name: string;
    phone?: string;
    email?: string;
    address?: string;
  };
  estimate: {
    number?: string | null;
    type: string; // "binding" | "non_binding" | etc.
    issued_at?: string;
    valid_until?: string | null;
    service_date?: string | null;
    line_items: LineItem[];
    subtotal: number;
    discounts?: number;
    sales_tax?: number;
    amount: number;
    deposit_amount?: number;
    notes?: string;
  };
  origin?: string;
  destination?: string;
}

function fmt(n: number | undefined | null): string {
  return `$${(n ?? 0).toFixed(2)}`;
}

function typeLabel(t: string): string {
  switch (t) {
    case "binding":
      return "Binding Estimate";
    case "binding_nte":
      return "Binding Not-to-Exceed";
    case "hourly":
      return "Hourly Estimate";
    case "flat_rate":
      return "Flat Rate Estimate";
    default:
      return "Non-Binding Estimate";
  }
}

export function EstimatePdf({ company, customer, estimate, origin, destination }: EstimatePdfProps) {
  return (
    <Document title={`Estimate ${estimate.number ?? ""}`}>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.companyBlock}>
            <Text style={styles.companyName}>{company.name}</Text>
            {company.address ? <Text style={styles.companyMeta}>{company.address}</Text> : null}
            {company.phone ? <Text style={styles.companyMeta}>{company.phone}</Text> : null}
            {company.email ? <Text style={styles.companyMeta}>{company.email}</Text> : null}
          </View>
          <View style={styles.estimateBlock}>
            <Text style={styles.estimateTitle}>ESTIMATE</Text>
            {estimate.number ? <Text style={styles.estimateNumber}>#{estimate.number}</Text> : null}
            {estimate.issued_at ? (
              <Text style={styles.companyMeta}>Issued: {estimate.issued_at}</Text>
            ) : null}
            {estimate.valid_until ? (
              <Text style={styles.companyMeta}>Valid until: {estimate.valid_until}</Text>
            ) : null}
          </View>
        </View>

        {/* Type badge */}
        <Text style={styles.badge}>{typeLabel(estimate.type)}</Text>

        {/* Customer + service */}
        <View style={styles.customerSection}>
          <View style={styles.customerBlock}>
            <Text style={styles.blockLabel}>Customer</Text>
            <Text style={styles.blockText}>{customer.name}</Text>
            {customer.phone ? <Text style={styles.blockText}>{customer.phone}</Text> : null}
            {customer.email ? <Text style={styles.blockText}>{customer.email}</Text> : null}
            {customer.address ? <Text style={styles.blockText}>{customer.address}</Text> : null}
          </View>
          <View style={styles.customerBlock}>
            <Text style={styles.blockLabel}>Service</Text>
            {estimate.service_date ? (
              <Text style={styles.blockText}>Service date: {estimate.service_date}</Text>
            ) : null}
            {origin ? <Text style={styles.blockText}>From: {origin}</Text> : null}
            {destination ? <Text style={styles.blockText}>To: {destination}</Text> : null}
          </View>
        </View>

        {/* Line items table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.colLabel}>Description</Text>
            <Text style={styles.colQty}>Qty</Text>
            <Text style={styles.colRate}>Rate</Text>
            <Text style={styles.colSubtotal}>Amount</Text>
          </View>
          {estimate.line_items.map((li, i) => (
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

        {/* Totals */}
        <View style={styles.totalsBlock}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{fmt(estimate.subtotal)}</Text>
          </View>
          {(estimate.discounts ?? 0) > 0 ? (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Discounts</Text>
              <Text style={styles.totalValue}>-{fmt(estimate.discounts)}</Text>
            </View>
          ) : null}
          {(estimate.sales_tax ?? 0) > 0 ? (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Sales tax</Text>
              <Text style={styles.totalValue}>{fmt(estimate.sales_tax)}</Text>
            </View>
          ) : null}
          <View style={styles.grandTotal}>
            <Text>Total</Text>
            <Text>{fmt(estimate.amount)}</Text>
          </View>
          {(estimate.deposit_amount ?? 0) > 0 ? (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Deposit due</Text>
              <Text style={styles.totalValue}>{fmt(estimate.deposit_amount)}</Text>
            </View>
          ) : null}
        </View>

        {/* Terms */}
        <View style={styles.termsSection}>
          <Text style={styles.termsTitle}>Terms &amp; Conditions</Text>
          <Text style={styles.termsText}>
            {estimate.type === "binding"
              ? "This is a Binding Estimate. The total price shown will not change regardless of actual time or weight, provided the inventory and services match what was quoted."
              : estimate.type === "binding_nte"
              ? "This is a Binding Not-to-Exceed Estimate. The final price will not exceed the total shown. If the actual cost is lower, you pay the lower amount."
              : estimate.type === "hourly"
              ? "Hourly rates are locked. The final price is calculated from actual time worked at the rates shown above."
              : "This is a Non-Binding Estimate. Final cost is based on actual hours, weight, and services rendered. Price may vary from this estimate."}
          </Text>
        </View>

        {/* Signature */}
        <View style={styles.signatureRow}>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Customer signature</Text>
            <View style={[styles.signatureLine, { marginTop: 16 }]} />
            <Text style={styles.signatureLabel}>Date</Text>
          </View>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Authorized representative</Text>
            <View style={[styles.signatureLine, { marginTop: 16 }]} />
            <Text style={styles.signatureLabel}>Date</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
