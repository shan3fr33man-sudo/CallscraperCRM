"use client";
import { useEffect, useState } from "react";
import { TopBar } from "@/components/TopBar";
import { EmptyState, ErrorBanner } from "@/components/ui";
import { Truck } from "lucide-react";

type Job = Record<string, unknown> & { id: string };

const STATUS_COLORS: Record<string, string> = {
  booked: "bg-blue-500",
  confirmed: "bg-green-500",
  en_route: "bg-orange-500",
  in_progress: "bg-yellow-500",
  finished: "bg-gray-400",
  closed: "bg-gray-300",
};

const STATUS_FLOW = ["booked", "confirmed", "en_route", "in_progress", "finished"] as const;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function DispatchCommandCenter() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/jobs?date=${todayISO()}`);
      const j = await r.json();
      if (j.error) {
        setError(j.error);
      } else {
        setJobs(j.jobs ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load today's jobs");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function advance(job: Job) {
    const idx = STATUS_FLOW.indexOf(job.status as typeof STATUS_FLOW[number]);
    const next = STATUS_FLOW[Math.min(idx + 1, STATUS_FLOW.length - 1)];
    await fetch(`/api/jobs/${job.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: next }) });
    load();
  }

  async function bulkSms(template: "customer_confirm" | "crew_confirm") {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    await Promise.all(ids.map((id) => fetch("/api/messages/send", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ template_key: template, related_type: "job", related_id: id }) }).catch(() => null)));
    setSelected(new Set());
    alert(`Queued ${ids.length} ${template === "customer_confirm" ? "customer" : "crew"} messages.`);
  }

  function toggleSel(id: string) {
    const s = new Set(selected);
    if (s.has(id)) s.delete(id); else s.add(id);
    setSelected(s);
  }

  function flagsFor(j: Job): string[] {
    const f: string[] = [];
    if (!j.crew_size || (j.crew_size as number) === 0) f.push("no crew");
    if (!j.truck_ids || (Array.isArray(j.truck_ids) && (j.truck_ids as unknown[]).length === 0)) f.push("no truck");
    if (j.status === "booked") f.push("unconfirmed");
    return f;
  }

  const counts = STATUS_FLOW.map((s) => ({ status: s, count: jobs.filter((j) => j.status === s).length }));

  return (
    <div>
      <TopBar title="Dispatch Command Center" />
      <div className="p-5 space-y-4">
        {error ? <ErrorBanner message={error} onRetry={load} /> : null}
        {/* Status strip */}
        <div className="grid grid-cols-5 gap-3">
          {counts.map((c) => (
            <div key={c.status} className="border border-border rounded-lg p-3 bg-background">
              <div className="text-[10px] uppercase text-muted-foreground">{c.status.replace("_", " ")}</div>
              <div className="text-2xl font-semibold flex items-center gap-2">
                <span className={`inline-block w-2 h-2 rounded-full ${STATUS_COLORS[c.status]}`} />{c.count}
              </div>
            </div>
          ))}
        </div>

        {/* Bulk action bar */}
        <div className="flex items-center gap-2 border border-border rounded-lg p-2 bg-background">
          <div className="text-xs text-muted-foreground px-2">{selected.size} selected</div>
          <button onClick={() => bulkSms("customer_confirm")} disabled={selected.size === 0} className="text-xs px-3 py-1.5 rounded-md bg-accent text-white disabled:opacity-40">Send Customer Confirmation</button>
          <button onClick={() => bulkSms("crew_confirm")} disabled={selected.size === 0} className="text-xs px-3 py-1.5 rounded-md border border-border disabled:opacity-40">Send Crew Confirmation</button>
          <div className="flex-1" />
          <button onClick={load} className="text-xs px-3 py-1.5 rounded-md border border-border">Refresh</button>
        </div>

        {/* Jobs board */}
        <div className="border border-border rounded-lg bg-background overflow-hidden">
          <div className="px-4 py-2 border-b border-border text-xs font-medium">Today's Jobs ({jobs.length})</div>
          {loading ? (
            <div className="p-4 text-xs text-muted-foreground">Loading…</div>
          ) : jobs.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={<Truck className="w-6 h-6" />}
                title="No jobs scheduled today"
                description="Accepted estimates auto-generate jobs on their service date. Point customers at pending estimates to keep this board full."
                action={
                  <a
                    href="/sales/new-leads"
                    className="inline-flex items-center gap-1 text-sm bg-accent text-white px-3 py-1.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                  >
                    Open new leads
                  </a>
                }
                compact
              />
            </div>
          ) : (
            <div className="divide-y divide-border">
              {jobs.map((j) => {
                const flags = flagsFor(j);
                return (
                  <div key={j.id} className="px-4 py-3 flex items-center gap-3 text-xs">
                    <input type="checkbox" checked={selected.has(j.id)} onChange={() => toggleSel(j.id)} />
                    <span className={`inline-block w-2 h-2 rounded-full ${STATUS_COLORS[String(j.status ?? "booked")] ?? "bg-gray-300"}`} />
                    <div className="w-24 truncate font-mono text-[10px]">{String(j.quote_number ?? j.id).slice(0, 8)}</div>
                    <div className="flex-1 truncate font-medium">{String(j.customer_name ?? "—")}</div>
                    <div className="w-24 truncate text-muted-foreground">{String(j.service_type ?? "—")}</div>
                    <div className="w-20 truncate text-muted-foreground">{String(j.arrival_window ?? "—")}</div>
                    <div className="w-16 text-muted-foreground">crew {String(j.crew_size ?? 0)}</div>
                    <div className="flex gap-1">
                      {flags.map((f) => <span key={f} className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700">{f}</span>)}
                    </div>
                    <div className="w-20 text-right">{String(j.status ?? "—")}</div>
                    <button onClick={() => advance(j)} className="text-[10px] px-2 py-1 rounded-md border border-border hover:bg-accent/10">Advance</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
