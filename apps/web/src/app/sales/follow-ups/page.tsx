"use client";
import { TopBar } from "@/components/TopBar";
import { EntityTable, type Row } from "@/components/EntityTable";

export default function FollowUpsPage() {
  async function fetchTasks(): Promise<Row[]> {
    const r = await fetch("/api/tasks");
    const j = await r.json();
    return (j.tasks ?? []).filter((t: Row) => t.type === "follow_up" && t.related_type === "opportunity");
  }
  return (
    <div>
      <TopBar title="Sales Follow-ups" />
      <div className="p-5">
        <EntityTable
          query={fetchTasks}
          columns={[
            { key: "due_at", label: "Due", render: (r) => r.due_at ? new Date(r.due_at as string).toLocaleString() : "—" },
            { key: "title", label: "Title" },
            { key: "related_id", label: "Opportunity" },
            { key: "assigned_to", label: "Assigned To" },
            { key: "priority", label: "Priority" },
          ]}
          emptyMessage="No sales follow-ups scheduled."
        />
      </div>
    </div>
  );
}
