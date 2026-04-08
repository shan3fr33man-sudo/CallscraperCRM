"use client";
import { TopBar } from "@/components/TopBar";
import { EntityTable, type Row } from "@/components/EntityTable";

export default function DueTodayPage() {
  async function load(): Promise<Row[]> {
    const r = await fetch("/api/tasks");
    const j = await r.json();
    const today = new Date().toISOString().slice(0, 10);
    return (j.tasks ?? []).filter((t: Row) => t.status !== "completed" && String(t.due_at ?? "").slice(0, 10) === today);
  }
  return (
    <div>
      <TopBar title="Due Today" />
      <div className="p-5">
        <EntityTable
          query={load}
          columns={[
            { key: "due_at", label: "Due", render: (r) => r.due_at ? new Date(r.due_at as string).toLocaleTimeString() : "—" },
            { key: "title", label: "Title" },
            { key: "type", label: "Type" },
            { key: "priority", label: "Priority" },
            { key: "assigned_to", label: "Assigned" },
          ]}
          emptyMessage="Nothing due today."
        />
      </div>
    </div>
  );
}
