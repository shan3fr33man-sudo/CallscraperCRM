"use client";
import { useState } from "react";
import { TopBar } from "@/components/TopBar";
import { EntityTable, type Row } from "@/components/EntityTable";
import { OpportunityDrawer } from "@/components/OpportunityDrawer";
import { NewButton } from "@/components/NewButton";

const STATUSES = [
  { value: "new", label: "New" },
  { value: "quoted", label: "Quoted" },
  { value: "booked", label: "Booked" },
  { value: "lost", label: "Lost" },
];

const SOURCES = ["phone", "web", "referral", "repeat", "google", "yelp", "other"].map((v) => ({ value: v, label: v }));

function ageDays(iso: string | null | undefined): string {
  if (!iso) return "—";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400_000);
  return `${days}d`;
}

export default function NewLeadsPage() {
  const [selected, setSelected] = useState<Row | null>(null);

  async function fetchOpps(): Promise<Row[]> {
    const r = await fetch("/api/opportunities");
    const j = await r.json();
    return (j.opportunities ?? []).filter((o: Row) => o.status === "new");
  }

  return (
    <div>
      <TopBar title="New Leads" />
      <div className="p-5">
        <EntityTable
          query={fetchOpps}
          onRowClick={(row) => setSelected(row)}
          columns={[
            { key: "status", label: "Status", render: (r) => <span className="text-xs px-2 py-0.5 rounded-md bg-blue-100 text-blue-700">{String(r.status ?? "—")}</span> },
            { key: "service_type", label: "Type" },
            { key: "service_date", label: "Service Date" },
            { key: "customer_name", label: "Name" },
            { key: "branch", label: "Branch" },
            { key: "move_size", label: "Move Size" },
            { key: "source", label: "Source", render: (r) => <span className="text-xs px-2 py-0.5 rounded-md bg-accent/10">{String(r.source ?? "—")}</span> },
            { key: "amount", label: "Amount", render: (r) => <span>${String(r.amount ?? 0)}</span> },
            { key: "created_at", label: "Age", render: (r) => ageDays(r.created_at as string) },
          ]}
          filters={[
            { key: "source", label: "Source", type: "chip", options: SOURCES },
            { key: "status", label: "Status", type: "chip", options: STATUSES },
          ]}
          actions={<NewButton kind="lead" label="New Lead" />}
          emptyMessage="No new leads. Inbound calls will create new opportunities here."
        />
        {selected && <OpportunityDrawer opp={selected as Row & { id: string }} onClose={() => setSelected(null)} />}
      </div>
    </div>
  );
}
