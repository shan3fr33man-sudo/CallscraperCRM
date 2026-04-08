"use client";
import { TopBar } from "@/components/TopBar";
import { EntityTable, type Row } from "@/components/EntityTable";

export default function CompletedTicketsPage() {
  async function load(): Promise<Row[]> {
    const r = await fetch("/api/tickets?status=completed");
    const j = await r.json();
    return j.tickets ?? [];
  }
  return (
    <div>
      <TopBar title="Completed Tickets" />
      <div className="p-5">
        <EntityTable
          query={load}
          columns={[
            { key: "ticket_name", label: "Ticket" },
            { key: "type", label: "Type" },
            { key: "priority", label: "Priority" },
            { key: "assigned_to", label: "Assigned" },
            { key: "last_activity_at", label: "Closed", render: (r) => r.last_activity_at ? new Date(r.last_activity_at as string).toLocaleDateString() : "—" },
          ]}
          emptyMessage="No completed tickets."
        />
      </div>
    </div>
  );
}
