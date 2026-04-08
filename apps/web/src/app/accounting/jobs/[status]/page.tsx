"use client";
import { use } from "react";
import { TopBar } from "@/components/TopBar";
import { EntityTable, type Row } from "@/components/EntityTable";

const STATUS_MAP: Record<string, { label: string; filter: (r: Row) => boolean }> = {
  "pending-finalize": { label: "Pending Finalize", filter: (r) => r.status === "pending_finalize" },
  "pending-close": { label: "Pending Close", filter: (r) => r.status === "pending_close" },
  closed: { label: "Closed", filter: (r) => r.status === "closed" },
  all: { label: "All", filter: () => true },
};

export default function AccountingJobsPage({ params }: { params: Promise<{ status: string }> }) {
  const { status } = use(params);
  const cfg = STATUS_MAP[status] ?? STATUS_MAP.all;
  async function load(): Promise<Row[]> {
    const r = await fetch("/api/jobs");
    const j = await r.json();
    return (j.jobs ?? []).filter(cfg.filter);
  }
  return (
    <div>
      <TopBar title={`Accounting — ${cfg.label}`} />
      <div className="p-5">
        <EntityTable
          query={load}
          columns={[
            { key: "status", label: "Status" },
            { key: "customer_name", label: "Customer" },
            { key: "quote_number", label: "Job #" },
            { key: "service_type", label: "Type" },
            { key: "service_date", label: "Date" },
            { key: "billed", label: "Billed", render: (r) => <span>${String(r.billed ?? 0)}</span> },
          ]}
          emptyMessage="No jobs in this status."
        />
      </div>
    </div>
  );
}
