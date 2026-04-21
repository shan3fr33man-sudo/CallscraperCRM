"use client";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { EntityTable, type Row } from "@/components/EntityTable";
import { Button, ErrorBanner } from "@/components/ui";

const STATUS_MAP: Record<string, { label: string; filter: (r: Row) => boolean }> = {
  "pending-finalize": { label: "Pending Finalize", filter: (r) => r.status === "pending_finalize" },
  "pending-close": { label: "Pending Close", filter: (r) => r.status === "pending_close" },
  closed: { label: "Closed", filter: (r) => r.status === "closed" },
  all: { label: "All", filter: () => true },
};

export default function AccountingJobsPage({ params }: { params: Promise<{ status: string }> }) {
  const { status } = use(params);
  const cfg = STATUS_MAP[status] ?? STATUS_MAP.all;
  const router = useRouter();
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function load(): Promise<Row[]> {
    const r = await fetch("/api/jobs");
    const j = await r.json();
    if (j.error) throw new Error(j.error);
    return (j.jobs ?? []).filter(cfg.filter);
  }

  async function generateInvoice(jobId: string) {
    setGeneratingFor(jobId);
    setActionError(null);
    try {
      const res = await fetch("/api/invoices/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: jobId }),
      });
      const j = await res.json();
      if (!res.ok || !j.invoice) {
        setActionError(j.error ?? "Failed to generate invoice");
        return;
      }
      // /api/invoices/generate is idempotent (M3 commit 43db99a): a brand-new
      // create OR `existing: true` both return the canonical invoice. Both
      // paths land the user on the detail page.
      router.push(`/accounting/invoices/${j.invoice.id}`);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to generate invoice");
    } finally {
      setGeneratingFor(null);
    }
  }

  return (
    <div>
      <TopBar title={`Accounting — ${cfg.label}`} />
      <div className="p-5 space-y-3">
        {actionError ? (
          <ErrorBanner message={actionError} onRetry={() => setActionError(null)} />
        ) : null}
        <EntityTable
          query={load}
          columns={[
            { key: "status", label: "Status" },
            { key: "customer_name", label: "Customer" },
            { key: "quote_number", label: "Job #" },
            { key: "service_type", label: "Type" },
            { key: "service_date", label: "Date" },
            {
              key: "billed",
              label: "Billed",
              render: (r) => <span>${String(r.billed ?? 0)}</span>,
            },
            {
              key: "id",
              label: "",
              width: "120px",
              render: (r) => {
                const jobId = r.id as string;
                const isGenerating = generatingFor === jobId;
                return (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      generateInvoice(jobId);
                    }}
                    loading={isGenerating}
                    icon={!isGenerating ? <FileText className="w-3 h-3" /> : undefined}
                  >
                    {isGenerating ? "Creating" : "Create invoice"}
                  </Button>
                );
              },
            },
          ]}
          emptyMessage="No jobs in this status."
        />
      </div>
    </div>
  );
}
