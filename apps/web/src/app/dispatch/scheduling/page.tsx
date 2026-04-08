"use client";
import { TopBar } from "@/components/TopBar";
import { EntityTable, type Row } from "@/components/EntityTable";

export default function SchedulingPage() {
  async function load(): Promise<Row[]> {
    const r = await fetch("/api/jobs");
    const j = await r.json();
    const cutoff = Date.now() + 14 * 86400_000;
    return (j.jobs ?? []).filter((row: Row) => {
      if (!row.service_date) return false;
      const t = new Date(row.service_date as string).getTime();
      return t >= Date.now() - 86400_000 && t <= cutoff;
    });
  }
  return (
    <div>
      <TopBar title="Scheduling — Next 14 Days" />
      <div className="p-5">
        <EntityTable
          query={load}
          columns={[
            { key: "service_date", label: "Date" },
            { key: "arrival_window", label: "Window" },
            { key: "customer_name", label: "Customer" },
            { key: "service_type", label: "Type" },
            { key: "crew_size", label: "Crew" },
            { key: "status", label: "Status" },
          ]}
          emptyMessage="No jobs scheduled in the next 14 days."
        />
      </div>
    </div>
  );
}
