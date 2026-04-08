"use client";
import { useState } from "react";
import { TopBar } from "@/components/TopBar";
import { EntityTable, type Row } from "@/components/EntityTable";
import { OpportunityDrawer } from "@/components/OpportunityDrawer";
import { NewButton } from "@/components/NewButton";

export default function MyLeadsPage() {
  const [selected, setSelected] = useState<Row | null>(null);
  async function fetchOpps(): Promise<Row[]> {
    const r = await fetch("/api/opportunities");
    const j = await r.json();
    return j.opportunities ?? [];
  }
  return (
    <div>
      <TopBar title="My Leads" />
      <div className="p-5">
        <EntityTable
          query={fetchOpps}
          onRowClick={(row) => setSelected(row)}
          columns={[
            { key: "status", label: "Status" },
            { key: "customer_name", label: "Customer" },
            { key: "service_type", label: "Type" },
            { key: "service_date", label: "Service Date" },
            { key: "amount", label: "Amount", render: (r) => <span>${String(r.amount ?? 0)}</span> },
            { key: "source", label: "Source" },
          ]}
          actions={<NewButton kind="lead" label="New Lead" />}
          emptyMessage="No leads assigned to you yet."
        />
        {selected && <OpportunityDrawer opp={selected as Row & { id: string }} onClose={() => setSelected(null)} />}
      </div>
    </div>
  );
}
