"use client";
import { useState } from "react";
import { TopBar } from "@/components/TopBar";
import { EntityTable, type Row } from "@/components/EntityTable";
import { OpportunityDrawer } from "@/components/OpportunityDrawer";

export default function CustomersOpportunitiesPage() {
  const [selected, setSelected] = useState<Row | null>(null);
  async function load(): Promise<Row[]> {
    const r = await fetch("/api/opportunities");
    const j = await r.json();
    return j.opportunities ?? [];
  }
  return (
    <div>
      <TopBar title="All Opportunities" />
      <div className="p-5">
        <EntityTable
          query={load}
          onRowClick={(r) => setSelected(r)}
          columns={[
            { key: "status", label: "Status" },
            { key: "customer_name", label: "Customer" },
            { key: "service_type", label: "Type" },
            { key: "service_date", label: "Service Date" },
            { key: "amount", label: "Amount", render: (r) => <span>${String(r.amount ?? 0)}</span> },
            { key: "source", label: "Source" },
            { key: "lead_quality", label: "Quality" },
          ]}
          filters={[
            { key: "status", label: "Status", type: "chip", options: [
              { value: "new", label: "New" }, { value: "quoted", label: "Quoted" }, { value: "booked", label: "Booked" }, { value: "lost", label: "Lost" }] },
          ]}
          emptyMessage="No opportunities yet."
        />
        {selected && <OpportunityDrawer opp={selected as Row & { id: string }} onClose={() => setSelected(null)} />}
      </div>
    </div>
  );
}
