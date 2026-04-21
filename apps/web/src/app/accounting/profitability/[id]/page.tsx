"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, TrendingUp, TrendingDown } from "lucide-react";

type Job = { id: string; quote_number: string | null; status: string; service_date: string | null; opportunity_id: string };
type Estimate = { id: string; amount: number; charges_json: Array<{ label: string; subtotal: number }> | null; estimate_type: string };
type Invoice = { id: string; amount_due: number; amount_paid: number; balance: number; line_items_json: Array<{ label: string; subtotal: number }> | null; status: string };

export default function JobProfitabilityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      // Fetch job
      const jr = await fetch(`/api/jobs/${id}`).then((r) => r.json());
      const j = jr.job as Job | undefined;
      if (j) {
        setJob(j);
        // Fetch estimate for this opportunity (most recent accepted, or most recent)
        if (j.opportunity_id) {
          const es = await fetch(`/api/estimates?opportunity_id=${j.opportunity_id}`).then((r) => r.json());
          const accepted = (es.estimates as Estimate[] | undefined)?.find(
            (e: Estimate & { accepted_at?: string | null }) => e.accepted_at,
          );
          setEstimate(accepted ?? (es.estimates?.[0] ?? null));
        }
        // Fetch invoice for this job
        const iv = await fetch(`/api/invoices?job_id=${id}`).then((r) => r.json());
        setInvoice((iv.invoices as Invoice[] | undefined)?.[0] ?? null);
      }
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }
  if (!job) {
    return (
      <div className="p-6">
        <div className="text-sm text-muted-foreground">Job not found.</div>
      </div>
    );
  }

  const estTotal = estimate?.amount ?? 0;
  const invTotal = invoice?.amount_due ?? 0;
  const collected = invoice?.amount_paid ?? 0;
  const variance = invTotal - estTotal;
  const collectionRate = invTotal > 0 ? (collected / invTotal) * 100 : 0;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <button
        onClick={() => router.push(`/accounting/jobs/all`)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="w-3 h-3" /> Back to jobs
      </button>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Job Profitability</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Job #{job.quote_number ?? job.id.slice(0, 8)} \u00b7 {job.service_date ?? "—"} \u00b7 status: {job.status}
        </p>
      </div>

      {/* Summary metrics */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <Metric label="Estimated" value={estTotal} sub={estimate?.estimate_type ?? "—"} />
        <Metric label="Invoiced" value={invTotal} sub={invoice?.status ?? "no invoice"} />
        <Metric label="Collected" value={collected} sub={`${collectionRate.toFixed(0)}% of invoice`} />
        <Metric
          label="Variance"
          value={variance}
          sub={variance >= 0 ? "over estimate" : "under estimate"}
          tint={variance >= 0 ? "green" : "red"}
        />
      </div>

      {/* Three-column comparison */}
      <div className="grid grid-cols-3 gap-4">
        <Column title="Estimate" empty="No estimate found">
          {estimate && (
            <div>
              {(estimate.charges_json ?? []).map((li, i) => (
                <Line key={i} label={li.label} amount={li.subtotal} />
              ))}
              <Total label="Total" amount={estimate.amount} />
            </div>
          )}
        </Column>

        <Column title="Actual (Job)" empty="Pending finalization">
          <div className="text-xs text-muted-foreground italic px-3 py-2">
            Actual time + materials capture lands in v1.2 with the crew app. For now,
            actuals are pulled from the invoice line items.
          </div>
        </Column>

        <Column title="Invoice" empty="No invoice yet">
          {invoice && (
            <div>
              {(invoice.line_items_json ?? []).map((li, i) => (
                <Line key={i} label={li.label} amount={li.subtotal} />
              ))}
              <Total label="Total" amount={invoice.amount_due} />
              <Line label="Paid" amount={collected} dim />
              <Total label="Balance" amount={invoice.balance} />
            </div>
          )}
        </Column>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  tint,
}: {
  label: string;
  value: number;
  sub?: string;
  tint?: "green" | "red";
}) {
  const tintClass =
    tint === "green" ? "border-green-200 bg-green-50/50" : tint === "red" ? "border-red-200 bg-red-50/50" : "border-border bg-accent/5";
  const Icon = tint === "green" ? TrendingUp : tint === "red" ? TrendingDown : null;
  return (
    <div className={`border rounded-md p-3 ${tintClass}`}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold font-mono mt-1 flex items-center gap-1">
        {Icon && <Icon className="w-4 h-4" />}
        ${Math.abs(value).toFixed(2)}
      </div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function Column({ title, children, empty }: { title: string; children: React.ReactNode; empty: string }) {
  return (
    <div className="border border-border rounded-md overflow-hidden">
      <div className="px-3 py-2 bg-accent/10 text-xs font-semibold border-b border-border">{title}</div>
      <div className="text-sm">
        {children}
      </div>
      {!children && (
        <div className="text-xs text-muted-foreground italic px-3 py-2">{empty}</div>
      )}
    </div>
  );
}

function Line({ label, amount, dim }: { label: string; amount: number; dim?: boolean }) {
  return (
    <div className={`flex justify-between px-3 py-1 text-xs border-b border-border ${dim ? "text-muted-foreground" : ""}`}>
      <span>{label}</span>
      <span className="font-mono">${amount.toFixed(2)}</span>
    </div>
  );
}

function Total({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="flex justify-between px-3 py-2 text-sm font-semibold border-t-2 border-border">
      <span>{label}</span>
      <span className="font-mono">${amount.toFixed(2)}</span>
    </div>
  );
}
