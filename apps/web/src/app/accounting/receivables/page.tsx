"use client";

import { useEffect, useState } from "react";
import { DollarSign, AlertCircle, CheckCircle, Send, FileText } from "lucide-react";
import { EmptyState } from "@/components/ui";

type Invoice = {
  id: string;
  invoice_number: string;
  status: string;
  customer_id: string | null;
  amount_due: number;
  amount_paid: number;
  balance: number;
  due_date: string | null;
  issued_at: string | null;
  paid_at: string | null;
  created_at: string;
};

type Customer = { id: string; customer_name: string };

function ageBucket(dueDate: string | null): "current" | "1-30" | "31-60" | "61-90" | "90+" {
  if (!dueDate) return "current";
  const due = new Date(dueDate);
  const now = new Date();
  const days = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "current";
  if (days <= 30) return "1-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}

export default function AccountsReceivablePage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterAge, setFilterAge] = useState<string>("");

  async function reload() {
    setLoading(true);
    const [iRes, cRes] = await Promise.all([
      fetch("/api/invoices").then((r) => r.json()),
      fetch("/api/customers").then((r) => r.json()),
    ]);
    setInvoices(iRes.invoices ?? []);
    const map = new Map<string, string>();
    for (const c of (cRes.customers ?? []) as Customer[]) {
      map.set(c.id, c.customer_name ?? "Unknown");
    }
    setCustomers(map);
    setLoading(false);
  }

  useEffect(() => {
    reload();
  }, []);

  const outstanding = invoices.filter((i) => ["sent", "partial", "overdue"].includes(i.status));
  const overdue = outstanding.filter((i) => i.due_date && new Date(i.due_date) < new Date());
  const collectedThisMonth = invoices
    .filter((i) => i.paid_at && new Date(i.paid_at).getMonth() === new Date().getMonth())
    .reduce((s, i) => s + (i.amount_paid ?? 0), 0);

  const buckets = {
    current: 0,
    "1-30": 0,
    "31-60": 0,
    "61-90": 0,
    "90+": 0,
  };
  for (const inv of outstanding) {
    buckets[ageBucket(inv.due_date)] += inv.balance;
  }

  let visible = invoices;
  if (filterStatus) visible = visible.filter((i) => i.status === filterStatus);
  if (filterAge) visible = visible.filter((i) => ageBucket(i.due_date) === filterAge);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Accounts Receivable</h1>
        <p className="text-sm text-muted-foreground mt-1">Outstanding invoices and aging.</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <SummaryCard
          icon={<DollarSign className="w-4 h-4" />}
          label="Total Outstanding"
          value={`$${outstanding.reduce((s, i) => s + i.balance, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          sub={`${outstanding.length} invoice${outstanding.length !== 1 ? "s" : ""}`}
        />
        <SummaryCard
          icon={<AlertCircle className="w-4 h-4 text-red-500" />}
          label="Overdue"
          value={`$${overdue.reduce((s, i) => s + i.balance, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          sub={`${overdue.length} past due`}
          tint="red"
        />
        <SummaryCard
          icon={<CheckCircle className="w-4 h-4 text-green-500" />}
          label="Collected This Month"
          value={`$${collectedThisMonth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          sub="Payments received"
          tint="green"
        />
      </div>

      {/* Aging buckets */}
      <div className="border border-border rounded-md p-4 mb-6 bg-accent/5">
        <h3 className="text-sm font-semibold mb-3">Aging Summary</h3>
        <div className="grid grid-cols-5 gap-2">
          {(Object.keys(buckets) as Array<keyof typeof buckets>).map((k) => (
            <button
              key={k}
              onClick={() => setFilterAge(filterAge === k ? "" : k)}
              className={`border rounded-md p-3 text-left ${
                filterAge === k ? "border-accent bg-background" : "border-border bg-background hover:bg-accent/5"
              }`}
            >
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {k === "current" ? "Current" : `${k} days`}
              </div>
              <div className="text-sm font-mono font-semibold mt-1">
                ${buckets[k].toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-3 items-center">
        <span className="text-xs text-muted-foreground">Status:</span>
        {["", "draft", "sent", "partial", "paid", "overdue"].map((s) => (
          <button
            key={s || "all"}
            onClick={() => setFilterStatus(s)}
            className={`text-xs px-2 py-1 rounded-md border ${
              filterStatus === s ? "bg-accent text-white border-accent" : "border-border"
            }`}
          >
            {s || "All"}
          </button>
        ))}
        {filterAge && (
          <button
            onClick={() => setFilterAge("")}
            className="text-xs px-2 py-1 rounded-md border border-accent text-accent ml-2"
          >
            Age: {filterAge} ✕
          </button>
        )}
      </div>

      {/* Invoice table */}
      <div className="border border-border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-accent/5 text-xs">
            <tr>
              <th className="text-left px-3 py-2">Invoice #</th>
              <th className="text-left px-3 py-2">Customer</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-right px-3 py-2">Total</th>
              <th className="text-right px-3 py-2">Paid</th>
              <th className="text-right px-3 py-2">Balance</th>
              <th className="text-left px-3 py-2">Due</th>
              <th className="text-left px-3 py-2">Age</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading &&
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} className="border-t border-border">
                  {Array.from({ length: 9 }).map((_, j) => (
                    <td key={j} className="px-3 py-2">
                      <div className="h-3 bg-accent/10 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))}
            {!loading && visible.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-6">
                  {(filterStatus || filterAge) ? (
                    <div className="text-center text-xs text-muted-foreground">
                      No invoices match the current filters.
                    </div>
                  ) : (
                    <EmptyState
                      icon={<DollarSign className="w-6 h-6" />}
                      title="No invoices yet"
                      description="Invoices auto-generate when a customer signs an estimate. Drafts and overdue balances will appear here."
                      compact
                    />
                  )}
                </td>
              </tr>
            )}
            {!loading &&
              visible.map((i) => (
                <tr key={i.id} className="border-t border-border hover:bg-accent/5">
                  <td className="px-3 py-2 font-mono text-xs">{i.invoice_number}</td>
                  <td className="px-3 py-2 text-xs">
                    {i.customer_id ? customers.get(i.customer_id) ?? "—" : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={i.status} />
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs">${i.amount_due.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-green-600">
                    ${i.amount_paid.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs font-semibold">
                    ${i.balance.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-xs">{i.due_date ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">{ageBucket(i.due_date)}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <a
                        href={`/api/invoices/${i.id}/pdf`}
                        target="_blank"
                        className="text-xs px-1.5 py-0.5 rounded border border-border hover:bg-background"
                        title="Download PDF"
                      >
                        <FileText className="w-3 h-3" />
                      </a>
                      {i.status !== "paid" && (
                        <button
                          onClick={async () => {
                            await fetch(`/api/invoices/${i.id}/send`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ channel: "email" }),
                            });
                            reload();
                          }}
                          className="text-xs px-1.5 py-0.5 rounded border border-border hover:bg-background"
                          title="Send"
                        >
                          <Send className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex gap-2">
        <a
          href="/api/invoices/export?format=csv"
          className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-accent/5"
        >
          Export CSV (QuickBooks)
        </a>
      </div>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  sub,
  tint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tint?: "red" | "green";
}) {
  const tintClass =
    tint === "red"
      ? "border-red-200 bg-red-50/50"
      : tint === "green"
      ? "border-green-200 bg-green-50/50"
      : "border-border bg-accent/5";
  return (
    <div className={`border rounded-md p-4 ${tintClass}`}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-semibold font-mono">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: "bg-accent/10 text-accent",
    sent: "bg-blue-50 text-blue-700",
    partial: "bg-amber-50 text-amber-700",
    paid: "bg-green-50 text-green-700",
    overdue: "bg-red-50 text-red-700",
    void: "bg-gray-100 text-gray-500",
  };
  const cls = styles[status] ?? "bg-gray-100";
  return <span className={`text-xs px-2 py-0.5 rounded ${cls}`}>{status}</span>;
}
