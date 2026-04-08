"use client";
import { TopBar } from "@/components/TopBar";
import { EntityTable, type Row } from "@/components/EntityTable";
import { NewButton } from "@/components/NewButton";

async function complete(id: string) {
  await fetch(`/api/tasks/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "completed" }) });
  location.reload();
}

export default function OpenTasksPage() {
  async function load(): Promise<Row[]> {
    const r = await fetch("/api/tasks");
    const j = await r.json();
    return (j.tasks ?? []).filter((t: Row) => t.status !== "completed");
  }
  return (
    <div>
      <TopBar title="Open Tasks" />
      <div className="p-5">
        <EntityTable
          query={load}
          columns={[
            { key: "due_at", label: "Due", render: (r) => r.due_at ? new Date(r.due_at as string).toLocaleString() : "—" },
            { key: "title", label: "Title" },
            { key: "type", label: "Type" },
            { key: "priority", label: "Priority" },
            { key: "assigned_to", label: "Assigned" },
            { key: "id", label: "", render: (r) => <button onClick={(e) => { e.stopPropagation(); complete(r.id as string); }} className="text-[10px] px-2 py-0.5 rounded border border-border">Complete</button> },
          ]}
          actions={<NewButton kind="task" />}
          emptyMessage="No open tasks."
        />
      </div>
    </div>
  );
}
