"use client";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileText, Send, RefreshCw } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { Button, EmptyState, ErrorBanner, StatusBadge } from "@/components/ui";
import { PaymentRecorder } from "@/components/PaymentRecorder";
import { SendInvoiceDialog } from "@/components/SendInvoiceDialog";

type LineItem = {
  label: string;
  kind?: string;
  rate?: number;
  quantity?: number;
  unit?: string;
  subtotal: number;
};

type Invoice = {
  id: string;
  invoice_number: string | null;
  status: string;
  customer_id: string | null;
  opportunity_id: string | null;
  estimate_id: string | null;
  job_id: string | null;
  line_items_json: LineItem[] | null;
  subtotal: number;
  discounts: number;
  sales_tax: number;
  amount_due: number;
  amount_paid: number;
  balance: number;
  due_date: string | null;
  issued_at: string | null;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
};

type Payment = {
  id: string;
  amount: number;
  method: string;
  status: string;
  reference: string | null;
  processed_at: string | null;
  created_at: string;
};

type Customer = {
  id: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
};

/**
 * Invoice detail page. Shows line items, totals, payment history, and the
 * record-payment and send-to-customer actions. This is the page that closes
 * the revenue loop visually: estimate → sign → auto-invoice (via automation)
 * → user lands here → records payments → balance drops via DB trigger.
 */
export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPay, setShowPay] = useState(false);
  const [showSend, setShowSend] = useState(false);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const j = await fetch(`/api/invoices/${id}`).then((r) => r.json());
      if (j.error) {
        setError(j.error);
        return;
      }
      setInvoice(j.invoice ?? null);
      setPayments(j.payments ?? []);
      // Pull customer contact info for the Send dialog pre-fill
      if (j.invoice?.customer_id) {
        const cr = await fetch(`/api/customers/${j.invoice.customer_id}`).then((r) => r.json()).catch(() => null);
        if (cr?.customer) setCustomer(cr.customer as Customer);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load invoice");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading && !invoice) {
    return (
      <div>
        <TopBar title="Invoice" />
        <div className="p-5 text-sm text-muted">Loading…</div>
      </div>
    );
  }

  if (error && !invoice) {
    return (
      <div>
        <TopBar title="Invoice" />
        <div className="p-5">
          <ErrorBanner message={error} onRetry={reload} />
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div>
        <TopBar title="Invoice" />
        <div className="p-5">
          <EmptyState
            icon={<FileText className="w-6 h-6" />}
            title="Invoice not found"
            description="This invoice may have been deleted or never existed."
            action={
              <Button variant="secondary" onClick={() => router.push("/accounting/receivables")}>
                Back to Accounts Receivable
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  const invoiceNumber = invoice.invoice_number ?? invoice.id.slice(0, 8).toUpperCase();
  const lineItems = invoice.line_items_json ?? [];

  return (
    <div>
      <TopBar
        title={`Invoice #${invoiceNumber}`}
        aiContext={{
          page: "accounting.invoice.detail",
          record_type: "invoice",
          record_id: invoice.id,
        }}
      />

      <SendInvoiceDialog
        open={showSend}
        invoiceId={invoice.id}
        defaultEmail={customer?.customer_email ?? ""}
        defaultPhone={customer?.customer_phone ?? ""}
        onClose={() => setShowSend(false)}
        onSent={reload}
      />

      <div className="p-5 max-w-5xl mx-auto space-y-4">
        {error ? <ErrorBanner message={error} onRetry={reload} /> : null}

        <button
          onClick={() => router.push("/accounting/receivables")}
          className="flex items-center gap-1 text-xs text-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 rounded"
        >
          <ArrowLeft className="w-3 h-3" /> Accounts Receivable
        </button>

        {/* Header */}
        <div className="border border-border rounded-lg p-4 bg-panel flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-semibold">Invoice #{invoiceNumber}</h1>
              <StatusBadge status={invoice.status} />
            </div>
            <div className="text-xs text-muted space-x-3">
              {customer?.customer_name ? <span>Billed to: {customer.customer_name}</span> : null}
              {invoice.issued_at ? <span>Issued: {invoice.issued_at.slice(0, 10)}</span> : null}
              {invoice.due_date ? <span>Due: {invoice.due_date}</span> : null}
              {invoice.paid_at ? <span className="text-green-500">Paid: {invoice.paid_at.slice(0, 10)}</span> : null}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`/api/invoices/${invoice.id}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-md border border-border hover:bg-accent/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              <FileText className="w-3 h-3" /> PDF
            </a>
            {invoice.status !== "paid" && invoice.status !== "void" ? (
              <Button onClick={() => setShowSend(true)} icon={<Send className="w-3 h-3" />}>
                Send to customer
              </Button>
            ) : null}
          </div>
        </div>

        {/* Line items + totals */}
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 border border-border rounded-lg bg-panel overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-accent/5 text-xs">
                <tr>
                  <th className="text-left px-3 py-2">Description</th>
                  <th className="text-right px-3 py-2 w-20">Qty</th>
                  <th className="text-right px-3 py-2 w-28">Rate</th>
                  <th className="text-right px-3 py-2 w-28">Amount</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-center text-xs text-muted">
                      No line items on this invoice.
                    </td>
                  </tr>
                )}
                {lineItems.map((li, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-3 py-2">{li.label}</td>
                    <td className="px-3 py-2 text-right">
                      {li.quantity ?? 1} {li.unit ?? ""}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      ${(li.rate ?? 0).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">${li.subtotal.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals + record payment */}
          <div className="col-span-1 space-y-3">
            <div className="border border-border rounded-lg bg-panel p-3 space-y-1 text-sm">
              <Row label="Subtotal" value={invoice.subtotal} />
              {invoice.discounts > 0 ? <Row label="Discounts" value={-invoice.discounts} muted /> : null}
              {invoice.sales_tax > 0 ? <Row label="Sales tax" value={invoice.sales_tax} muted /> : null}
              <div className="flex justify-between pt-2 border-t border-border font-semibold">
                <span>Total</span>
                <span className="font-mono">${invoice.amount_due.toFixed(2)}</span>
              </div>
              <Row label="Paid" value={invoice.amount_paid} dim />
              <div className={`flex justify-between pt-2 border-t border-border font-semibold ${invoice.balance > 0 ? "text-amber-500" : "text-green-500"}`}>
                <span>Balance due</span>
                <span className="font-mono">${invoice.balance.toFixed(2)}</span>
              </div>
            </div>

            {invoice.balance > 0 && invoice.status !== "void" ? (
              <>
                {showPay ? (
                  <PaymentRecorder
                    target={{ kind: "invoice", invoice_id: invoice.id }}
                    customerId={invoice.customer_id}
                    defaultAmount={invoice.balance}
                    maxHint={invoice.balance}
                    onPaid={() => {
                      // Keep PaymentRecorder visible (it shows its own
                      // "$X recorded" success card) AND refresh the parent
                      // so the user sees the balance/status flip too. Auto-
                      // collapse after 2s so they can record another
                      // payment if needed.
                      reload();
                      window.setTimeout(() => setShowPay(false), 2000);
                    }}
                  />
                ) : (
                  <Button onClick={() => setShowPay(true)} className="w-full justify-center">
                    Record payment
                  </Button>
                )}
              </>
            ) : null}

            <button
              onClick={reload}
              className="w-full flex items-center justify-center gap-1 text-xs px-3 py-1.5 rounded-md border border-border hover:bg-accent/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              <RefreshCw className="w-3 h-3" /> Refresh balance
            </button>
          </div>
        </div>

        {/* Payment history */}
        <div className="border border-border rounded-lg bg-panel overflow-hidden">
          <div className="px-3 py-2 border-b border-border text-xs font-semibold bg-accent/5">
            Payment history ({payments.length})
          </div>
          {payments.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-muted">
              No payments recorded yet.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs">
                <tr className="border-b border-border">
                  <th className="text-left px-3 py-2">Date</th>
                  <th className="text-left px-3 py-2">Method</th>
                  <th className="text-left px-3 py-2">Reference</th>
                  <th className="text-left px-3 py-2 w-24">Status</th>
                  <th className="text-right px-3 py-2 w-28">Amount</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="px-3 py-2 text-xs">
                      {(p.processed_at ?? p.created_at)?.slice(0, 10) ?? ""}
                    </td>
                    <td className="px-3 py-2 text-xs uppercase">{p.method}</td>
                    <td className="px-3 py-2 text-xs">{p.reference ?? "—"}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-sm">
                      ${p.amount.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  muted,
  dim,
}: {
  label: string;
  value: number;
  muted?: boolean;
  dim?: boolean;
}) {
  return (
    <div className={`flex justify-between ${muted ? "text-muted text-xs" : ""} ${dim ? "text-muted" : ""}`}>
      <span>{label}</span>
      <span className="font-mono">${value.toFixed(2)}</span>
    </div>
  );
}
