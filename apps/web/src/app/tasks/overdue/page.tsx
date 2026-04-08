"use client";
import { TopBar } from "@/components/TopBar";
import { EntityTable, type Row } from "@/components/EntityTable";

export default function OverduePage() {
  async function load(): Promise<Row[]> {
    const r = await fetch("/api/tasks");
    const j = await r.json();
    const now = Date.now();
    return (j.tasks ?? []).filter((t: Row) => t.status !== "completed" && t.due_at && new Date(t.due_at as string).getTime() < now);
  }
  return (
    <div>
      <TopBar title="Overdue Tasks" />
      <div className="p-5">
        <EntityTable
          query={load}
          columns={[
            { key: "due_at", label: "Due", render: (r) => r.due_at ? new Date(r.due_at as string).toLocaleString() : "—" },
            { key: "title", label: "Title" },
            { key: "type", label: "Type" },
            { key: "priority", label: "Priority" },
            { key: "assigned_to", label: "Assigned" },
          ]}
          emptyMessage="No overdue tasks. 🎉"
        />
      </div>
    </div>
  );
}
