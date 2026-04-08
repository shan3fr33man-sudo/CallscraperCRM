"use client";
import { TopBar } from "@/components/TopBar";
import { EntityTable, type Row } from "@/components/EntityTable";

export default function CompletedTasksPage() {
  async function load(): Promise<Row[]> {
    const r = await fetch("/api/tasks");
    const j = await r.json();
    return (j.tasks ?? []).filter((t: Row) => t.status === "completed");
  }
  return (
    <div>
      <TopBar title="Completed Tasks" />
      <div className="p-5">
        <EntityTable
          query={load}
          columns={[
            { key: "due_at", label: "Due", render: (r) => r.due_at ? new Date(r.due_at as string).toLocaleString() : "—" },
            { key: "title", label: "Title" },
            { key: "type", label: "Type" },
            { key: "assigned_to", label: "Assigned" },
          ]}
          emptyMessage="No completed tasks yet."
        />
      </div>
    </div>
  );
}
