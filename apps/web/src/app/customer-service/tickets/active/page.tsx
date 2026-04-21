"use client";
import { TopBar } from "@/components/TopBar";
import { EntityTable, type Row } from "@/components/EntityTable";
import { NewButton } from "@/components/NewButton";

const TICKET_TYPE_OPTIONS = [
  { value: "damage", label: "Damage" },
  { value: "service_complaint", label: "Service complaint" },
  { value: "billing", label: "Billing" },
  { value: "inquiry", label: "Inquiry" },
  { value: "compliment", label: "Compliment" },
  { value: "other", label: "Other" },
];

const TICKET_PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

export default function ActiveTicketsPage() {
  async function load(): Promise<Row[]> {
    const r = await fetch("/api/tickets?status=active");
    const j = await r.json();
    return j.tickets ?? [];
  }
  async function close(id: string) {
    await fetch(`/api/tickets/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "completed" }) });
    location.reload();
  }
  async function escalate(id: string) {
    await fetch(`/api/tickets/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ priority: "critical" }) });
    location.reload();
  }
  return (
    <div>
      <TopBar title="Active Tickets" />
      <div className="p-5">
        <EntityTable
          query={load}
          columns={[
            { key: "ticket_name", label: "Ticket" },
            { key: "type", label: "Type" },
            { key: "priority", label: "Priority" },
            { key: "assigned_to", label: "Assigned" },
            { key: "opened_at", label: "Opened", render: (r) => r.opened_at ? new Date(r.opened_at as string).toLocaleDateString() : "—" },
            { key: "id", label: "Actions", render: (r) => (
              <div className="flex gap-1">
                <button onClick={(e) => { e.stopPropagation(); close(r.id as string); }} className="text-[10px] px-2 py-0.5 rounded border border-border">Close</button>
                <button onClick={(e) => { e.stopPropagation(); escalate(r.id as string); }} className="text-[10px] px-2 py-0.5 rounded border border-red-300 text-red-700">Escalate</button>
              </div>
            ) },
          ]}
          filters={[
            // Search by ticket name first — that's the column users grep when
            // looking for "the laundry-room damage one." Substring match,
            // case-insensitive (EntityTable applies .toLowerCase() both sides).
            { key: "ticket_name", label: "Search by name", type: "search" },
            { key: "assigned_to", label: "Assignee", type: "search" },
            { key: "type", label: "Type", type: "select", options: TICKET_TYPE_OPTIONS },
            { key: "priority", label: "Priority", type: "chip", options: TICKET_PRIORITY_OPTIONS },
          ]}
          actions={<NewButton kind="ticket" />}
          emptyMessage="No active tickets."
        />
      </div>
    </div>
  );
}
