// React-PDF template for moving estimate, audited against WA Tariff 15-C
// Item 85(3). Twenty required elements are listed alongside their template
// section. Sections render conditionally — passing the relevant data triggers
// the section. The estimator + the /api/estimates/[id]/pdf route are
// responsible for sourcing this data.

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: "Helvetica", color: "#222" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 18, borderBottom: "2px solid #333", paddingBottom: 8 },
  companyBlock: { flexDirection: "column" },
  companyName: { fontSize: 18, fontWeight: 700, marginBottom: 4 },
  companyMeta: { fontSize: 9, color: "#666" },
  permit: { fontSize: 9, color: "#444", marginTop: 3 },
  estimateBlock: { flexDirection: "column", textAlign: "right" },
  estimateTitle: { fontSize: 22, fontWeight: 700, color: "#444" },
  estimateNumber: { fontSize: 11, marginTop: 4 },

  customerSection: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  customerBlock: { width: "48%" },
  blockLabel: { fontSize: 9, color: "#666", textTransform: "uppercase", marginBottom: 3, letterSpacing: 0.5 },
  blockText: { fontSize: 10, lineHeight: 1.4 },

  sectionTitle: { fontSize: 11, fontWeight: 700, marginTop: 14, marginBottom: 6, color: "#333", borderBottom: "0.5px solid #ccc", paddingBottom: 3 },

  inventoryRow: { flexDirection: "row", paddingVertical: 2, paddingHorizontal: 4, borderBottom: "0.25px solid #eee", fontSize: 9 },
  invRoom: { flex: 1.4 },
  invItem: { flex: 3 },
  invQty: { flex: 0.5, textAlign: "right" },
  invCuFt: { flex: 0.8, textAlign: "right" },

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

  valuationBox: { borderTop: "1px solid #333", borderBottom: "1px solid #333", paddingVertical: 10, paddingHorizontal: 8, marginTop: 14, fontSize: 9 },
  valuationTitle: { fontSize: 10, fontWeight: 700, marginBottom: 6 },
  valuationOption: { flexDirection: "row", marginBottom: 6 },
  valuationCheckbox: { width: 12, height: 12, border: "1px solid #333", marginRight: 6, marginTop: 1 },
  valuationOptionText: { flex: 1, fontSize: 9, lineHeight: 1.4 },

  termsSection: { marginTop: 16, paddingTop: 10, borderTop: "0.5px solid #ddd" },
  termsTitle: { fontSize: 10, fontWeight: 700, marginBottom: 6 },
  termsText: { fontSize: 9, lineHeight: 1.5, color: "#444" },

  acknowledgeBox: { marginTop: 12, paddingVertical: 8, paddingHorizontal: 8, border: "1px solid #888", fontSize: 9, lineHeight: 1.4 },
  acknowledgeRow: { flexDirection: "row", marginTop: 6 },
  acknowledgeInitials: { borderBottom: "1px solid #333", width: 60, marginRight: 6 },

  signatureRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 18 },
  signatureBlock: { width: "45%" },
  signatureLine: { borderBottom: "1px solid #333", height: 30, marginBottom: 4 },
  signatureLabel: { fontSize: 9, color: "#666" },

  paymentRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 4, fontSize: 9 },
  paymentChip: { borderWidth: 0.5, borderColor: "#888", paddingVertical: 2, paddingHorizontal: 6, marginRight: 4, marginBottom: 2, borderRadius: 2 },

  footer: { position: "absolute", bottom: 18, left: 36, right: 36, fontSize: 7, color: "#999", textAlign: "center" },
});

type LineItem = {
  label: string;
  kind?: string;
  rate?: number;
  quantity?: number;
  unit?: string;
  subtotal: number;
};

export type InventoryItem = {
  room: string;
  item: string;
  qty: number;
  cu_ft?: number;
};

export interface EstimatePdfProps {
  company: {
    name: string;
    address?: string;
    phone?: string;
    fax?: string;                     // 15-C 85(3)(a)
    email?: string;
    wutc_permit_number?: string;      // 15-C 85(3)(a) — required when known
  };
  customer: {
    name: string;
    phone?: string;
    email?: string;
    address?: string;
    contact_person?: string;          // 15-C 85(3)(e)
  };
  estimate: {
    number?: string | null;
    type: string;                     // "binding" | "non_binding" | etc.
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
    /** Pricing mode drives weight/mileage section visibility (15-C 85(3)(h)/(j)). */
    pricing_mode?: "local" | "long_distance";
    /** Long-distance only — estimated total weight in lb (15-C 85(3)(h)). */
    estimated_weight_lb?: number;
    /** Long-distance only — total drive miles (15-C 85(3)(j)). */
    total_miles?: number;
    /** Local only — predicted hours, crew, trucks (15-C 85(3)(i)). */
    estimated_hours?: number;
    crew_size?: number;
    truck_count?: number;
    /** Per-diem charges if overnight stay required (15-C 85(3)(s)). */
    per_diem_total?: number;
  };
  origin?: string;
  destination?: string;
  /** Intermediate pickup/delivery stops (15-C 85(3)(f)). */
  intermediate_stops?: string[];
  /** Cube sheet inventory (15-C 85(3)(g)). */
  inventory?: InventoryItem[];
  /** Customer-elected valuation, if known. */
  valuation?: {
    selected?: "basic" | "full_with_deductible" | "full_no_deductible";
    declared_value?: number;
    full_value_cost?: number;         // The $ cost of the full-value option, when selected.
  };
  /** Forms of payment the carrier accepts (15-C 85(3)(r)). */
  accepted_payment_methods?: string[];
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

const NONBINDING_TERMS = [
  "1. The estimate is not binding upon the carrier.",
  "2. The cost of the move may exceed the price listed on this estimate.",
  "3. The carrier must release the shipment to the customer upon payment of no more than 110 percent of the estimated charges. Customers will be allowed at least 30 days from the date of delivery to pay any amounts that exceed the 110 percent.",
  "4. The customer is not required to pay more than 125 percent of the estimate, regardless of total cost, unless the carrier issues and the customer accepts a supplemental estimate. (The 125 percent does not include any finance-related charges the carrier may assess for extending credit, such as interest or late payment fees.)",
];

const BINDING_TERMS =
  "This is a binding estimate. The total price shown is a guarantee of the cost of the move; the carrier will not charge above the estimated charges without preparing a supplemental estimate signed by the customer prior to additional work being performed (WA Tariff 15-C, Item 85(4)).";

export function EstimatePdf({
  company,
  customer,
  estimate,
  origin,
  destination,
  intermediate_stops,
  inventory,
  valuation,
  accepted_payment_methods,
}: EstimatePdfProps) {
  const isBinding = estimate.type === "binding" || estimate.type === "binding_nte";
  const isLongDistance = estimate.pricing_mode === "long_distance";
  return (
    <Document title={`Estimate ${estimate.number ?? ""}`}>
      <Page size="LETTER" style={styles.page}>
        {/* Header — 15-C 85(3)(a) carrier identity + WUTC permit */}
        <View style={styles.header}>
          <View style={styles.companyBlock}>
            <Text style={styles.companyName}>{company.name}</Text>
            {company.address ? <Text style={styles.companyMeta}>{company.address}</Text> : null}
            {company.phone ? <Text style={styles.companyMeta}>Phone: {company.phone}</Text> : null}
            {company.fax ? <Text style={styles.companyMeta}>Fax: {company.fax}</Text> : null}
            {company.email ? <Text style={styles.companyMeta}>{company.email}</Text> : null}
            {company.wutc_permit_number ? (
              <Text style={styles.permit}>WUTC Permit #{company.wutc_permit_number}</Text>
            ) : null}
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

        {/* 15-C 85(3)(b) binding/nonbinding tag */}
        <Text style={styles.badge}>{typeLabel(estimate.type)}</Text>

        {/* 15-C 85(3)(d) customer + (e) contact person + (f) origin/destination/stops + service */}
        <View style={styles.customerSection}>
          <View style={styles.customerBlock}>
            <Text style={styles.blockLabel}>Customer</Text>
            <Text style={styles.blockText}>{customer.name}</Text>
            {customer.phone ? <Text style={styles.blockText}>{customer.phone}</Text> : null}
            {customer.email ? <Text style={styles.blockText}>{customer.email}</Text> : null}
            {customer.address ? <Text style={styles.blockText}>{customer.address}</Text> : null}
            {customer.contact_person ? (
              <Text style={[styles.blockText, { marginTop: 4 }]}>
                Contact (if other than customer): {customer.contact_person}
              </Text>
            ) : null}
          </View>
          <View style={styles.customerBlock}>
            <Text style={styles.blockLabel}>Service</Text>
            {estimate.service_date ? (
              <Text style={styles.blockText}>Service date: {estimate.service_date}</Text>
            ) : null}
            {origin ? <Text style={styles.blockText}>From: {origin}</Text> : null}
            {destination ? <Text style={styles.blockText}>To: {destination}</Text> : null}
            {intermediate_stops && intermediate_stops.length > 0 ? (
              <Text style={[styles.blockText, { marginTop: 2 }]}>
                Intermediate stops: {intermediate_stops.join("; ")}
              </Text>
            ) : null}
          </View>
        </View>

        {/* 15-C 85(3)(i)/(j) crew + vehicles + hours + mileage block — visible per pricing mode */}
        {isLongDistance && estimate.estimated_weight_lb !== undefined ? (
          <View>
            <Text style={styles.sectionTitle}>Long-Distance Basis (Tariff 15-C Item 105)</Text>
            <Text style={styles.blockText}>
              Estimated weight: {estimate.estimated_weight_lb.toLocaleString()} lb
              {estimate.total_miles !== undefined ? ` · Distance: ${Math.round(estimate.total_miles)} mi` : ""}
            </Text>
            <Text style={[styles.blockText, { color: "#666", marginTop: 2 }]}>
              Weight estimated using the constructive-weight formula of seven (7) pounds per cubic foot of properly loaded vehicle space, per WA Tariff 15-C Item 10.
            </Text>
          </View>
        ) : null}
        {!isLongDistance && estimate.estimated_hours !== undefined ? (
          <View>
            <Text style={styles.sectionTitle}>Local Service Basis (Tariff 15-C Item 205)</Text>
            <Text style={styles.blockText}>
              Estimated time: {estimate.estimated_hours.toFixed(1)} hrs
              {estimate.crew_size !== undefined ? ` · Crew: ${estimate.crew_size}` : ""}
              {estimate.truck_count !== undefined ? ` · Trucks: ${estimate.truck_count}` : ""}
            </Text>
          </View>
        ) : null}

        {/* 15-C 85(3)(g) cube sheet inventory */}
        {inventory && inventory.length > 0 ? (
          <View>
            <Text style={styles.sectionTitle}>Inventory (Cube Sheet) — Tariff 15-C Item 85(3)(g)</Text>
            <View style={[styles.inventoryRow, { backgroundColor: "#f0f0f0", fontWeight: 700 }]}>
              <Text style={styles.invRoom}>Room</Text>
              <Text style={styles.invItem}>Item</Text>
              <Text style={styles.invQty}>Qty</Text>
              <Text style={styles.invCuFt}>Cu ft</Text>
            </View>
            {inventory.map((it, i) => (
              <View key={i} style={styles.inventoryRow}>
                <Text style={styles.invRoom}>{it.room}</Text>
                <Text style={styles.invItem}>{it.item}</Text>
                <Text style={styles.invQty}>{it.qty}</Text>
                <Text style={styles.invCuFt}>
                  {it.cu_ft !== undefined ? it.cu_ft.toFixed(1) : "—"}
                </Text>
              </View>
            ))}
            <Text style={[styles.blockText, { fontSize: 8, color: "#666", marginTop: 4 }]}>
              Total items: {inventory.reduce((s, x) => s + x.qty, 0).toLocaleString()}
              {" · "}
              Estimated cu ft: {inventory.reduce((s, x) => s + (x.cu_ft ?? 0) * x.qty, 0).toFixed(0)}
            </Text>
          </View>
        ) : null}

        {/* Line items — covers 15-C (k), (l), (n), (o), (s) when those line kinds present */}
        <Text style={styles.sectionTitle}>Charges</Text>
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
              <Text style={styles.totalLabel}>Sales tax (materials)</Text>
              <Text style={styles.totalValue}>{fmt(estimate.sales_tax)}</Text>
            </View>
          ) : null}
          {(estimate.per_diem_total ?? 0) > 0 ? (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Per-diem (overnight)</Text>
              <Text style={styles.totalValue}>{fmt(estimate.per_diem_total)}</Text>
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

        {/* 15-C 85(3)(m) valuation initial-block — verbatim text required */}
        <View style={styles.valuationBox}>
          <Text style={styles.valuationTitle}>
            LOSS AND DAMAGE PROTECTION (Valuation): The customer must select and initial only one of the following options.
          </Text>
          <View style={styles.valuationOption}>
            <View style={styles.valuationCheckbox} />
            <Text style={styles.valuationOptionText}>
              <Text style={{ fontWeight: 700 }}>Basic value protection.</Text> I release this shipment to a value of 72 cents per pound per article, at no cost to me. This means I will be paid 72 cents per pound for the net weight of the lost or damaged item, regardless of the actual value of the item.
              {valuation?.selected === "basic" ? "  ← SELECTED" : ""}
            </Text>
          </View>
          <View style={styles.valuationOption}>
            <View style={styles.valuationCheckbox} />
            <Text style={styles.valuationOptionText}>
              <Text style={{ fontWeight: 700 }}>Replacement cost coverage with deductible which includes a $300 deductible</Text> paid by me. This option will cost $
              {valuation?.selected === "full_with_deductible" && valuation.full_value_cost
                ? valuation.full_value_cost.toFixed(2)
                : "_______"}
              . The value I declare must be at least $9.16 times the net weight of the shipment.
              {valuation?.selected === "full_with_deductible" ? "  ← SELECTED" : ""}
            </Text>
          </View>
          <View style={styles.valuationOption}>
            <View style={styles.valuationCheckbox} />
            <Text style={styles.valuationOptionText}>
              <Text style={{ fontWeight: 700 }}>Replacement cost coverage with no deductible,</Text> at a cost of $
              {valuation?.selected === "full_no_deductible" && valuation.full_value_cost
                ? valuation.full_value_cost.toFixed(2)
                : "_______"}
              . The value I declare must be at least $9.16 times the net weight of the shipment.
              {valuation?.selected === "full_no_deductible" ? "  ← SELECTED" : ""}
            </Text>
          </View>
          <Text style={[styles.blockText, { fontSize: 9, marginTop: 6 }]}>
            I declare a lump sum total dollar valuation on this entire shipment of $
            {valuation?.declared_value ? valuation.declared_value.toLocaleString() : "_______"}.
          </Text>
        </View>

        {/* 15-C 85(3)(p) binding statement OR (q) nonbinding rules */}
        <View style={styles.termsSection}>
          <Text style={styles.termsTitle}>{isBinding ? "Binding Estimate Statement" : "Nonbinding Estimate Rules"}</Text>
          {isBinding ? (
            <Text style={styles.termsText}>{BINDING_TERMS}</Text>
          ) : (
            NONBINDING_TERMS.map((line, i) => (
              <Text key={i} style={[styles.termsText, { marginBottom: 3 }]}>
                {line}
              </Text>
            ))
          )}
        </View>

        {/* 15-C 85(3)(r) forms of payment */}
        {accepted_payment_methods && accepted_payment_methods.length > 0 ? (
          <View style={{ marginTop: 12 }}>
            <Text style={styles.termsTitle}>Accepted Forms of Payment</Text>
            <View style={styles.paymentRow}>
              {accepted_payment_methods.map((m, i) => (
                <Text key={i} style={styles.paymentChip}>
                  {m}
                </Text>
              ))}
            </View>
          </View>
        ) : null}

        {/* 15-C 85(3)(c) Consumer Guide acknowledgment */}
        <View style={styles.acknowledgeBox}>
          <Text style={{ fontWeight: 700, fontSize: 9 }}>Consumer Guide Acknowledgment (WAC 480-15-620)</Text>
          <Text style={[styles.blockText, { fontSize: 9, marginTop: 3 }]}>
            I acknowledge that I have received a copy of the commission publication "Consumer Guide to Moving in Washington State" along with this written estimate.
          </Text>
          <View style={styles.acknowledgeRow}>
            <Text>Customer initials:</Text>
            <View style={styles.acknowledgeInitials} />
            <Text>  Date:</Text>
            <View style={styles.acknowledgeInitials} />
          </View>
        </View>

        {/* 15-C 85(3)(t) signatures + dates */}
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

        <Text style={styles.footer} fixed>
          This estimate complies with WA Tariff 15-C Item 85(3). Carrier: {company.name}
          {company.wutc_permit_number ? ` · WUTC Permit #${company.wutc_permit_number}` : ""}
        </Text>
      </Page>
    </Document>
  );
}
