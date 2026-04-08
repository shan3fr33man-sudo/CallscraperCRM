"use client";
import { useEffect, useState } from "react";

export type FormKind = "opportunity" | "lead" | "task" | "follow_up";

type Field =
  | { key: string; label: string; type: "text" | "number" | "date" | "datetime"; required?: boolean }
  | { key: string; label: string; type: "select"; options: { value: string; label: string }[]; required?: boolean }
  | { key: string; label: string; type: "remote_select"; endpoint: string; valueKey: string; labelKey: string; required?: boolean };

const SERVICE_TYPES = [
  { value: "local", label: "Local" }, { value: "long_distance", label: "Long Distance" }, { value: "interstate", label: "Interstate" }, { value: "labor_only", label: "Labor Only" }, { value: "storage", label: "Storage" },
];
const MOVE_SIZES = ["studio", "1br", "2br", "3br", "4br", "5br+", "office", "commercial"].map((v) => ({ value: v, label: v }));
const OPP_TYPES = [{ value: "residential", label: "Residential" }, { value: "commercial", label: "Commercial" }, { value: "military", label: "Military" }, { value: "senior", label: "Senior" }];
const SOURCES = ["phone", "web", "referral", "repeat", "google", "yelp", "other"].map((v) => ({ value: v, label: v }));
const TASK_TYPES = ["follow_up", "call", "email", "task", "other"].map((v) => ({ value: v, label: v }));
const PRIORITIES = [{ value: "1", label: "low" }, { value: "2", label: "medium" }, { value: "3", label: "high" }, { value: "4", label: "critical" }];
const RELATED_TYPES = [{ value: "opportunity", label: "Opportunity" }, { value: "job", label: "Job" }, { value: "customer", label: "Customer" }];

const OPP_FIELDS: Field[] = [
  { key: "customer_name", label: "Customer name", type: "text", required: true },
  { key: "customer_phone", label: "Customer phone", type: "text" },
  { key: "service_type", label: "Service type", type: "select", options: SERVICE_TYPES },
  { key: "service_date", label: "Service date", type: "date" },
  { key: "move_size", label: "Move size", type: "select", options: MOVE_SIZES },
  { key: "origin_address", label: "Origin address", type: "text" },
  { key: "destination_address", label: "Destination address", type: "text" },
  { key: "branch_id", label: "Branch", type: "remote_select", endpoint: "/api/branches", valueKey: "id", labelKey: "name" },
  { key: "opportunity_type", label: "Opportunity type", type: "select", options: OPP_TYPES },
  { key: "source", label: "Source", type: "select", options: SOURCES },
  { key: "amount", label: "Estimated amount", type: "number" },
];

const TASK_FIELDS: Field[] = [
  { key: "title", label: "Title", type: "text", required: true },
  { key: "due_at", label: "Due", type: "datetime" },
  { key: "type", label: "Type", type: "select", options: TASK_TYPES },
  { key: "priority", label: "Priority", type: "select", options: PRIORITIES },
  { key: "related_type", label: "Related to (type)", type: "select", options: RELATED_TYPES },
  { key: "related_id", label: "Related id", type: "text" },
];

const FOLLOWUP_FIELDS: Field[] = TASK_FIELDS.filter((f) => f.key !== "type");

function configFor(kind: FormKind): { title: string; fields: Field[] } {
  if (kind === "opportunity") return { title: "New Opportunity", fields: OPP_FIELDS };
  if (kind === "lead") return { title: "New Lead", fields: OPP_FIELDS };
  if (kind === "task") return { title: "New Task", fields: TASK_FIELDS };
  return { title: "New Follow-up", fields: FOLLOWUP_FIELDS };
}

export function RecordForm({ kind, onClose }: { kind: FormKind; onClose: () => void }) {
  const cfg = configFor(kind);
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [remoteOpts, setRemoteOpts] = useState<Record<string, { value: string; label: string }[]>>({});

  useEffect(() => {
    cfg.fields.forEach(async (f) => {
      if (f.type !== "remote_select") return;
      try {
        const r = await fetch(f.endpoint);
        const j = await r.json();
        const arr = (j.branches ?? j.users ?? []).map((row: Record<string, unknown>) => ({ value: String(row[f.valueKey]), label: String(row[f.labelKey] ?? row[f.valueKey]) }));
        setRemoteOpts((prev) => ({ ...prev, [f.key]: arr }));
      } catch {}
    });
  }, [kind]);

  function set(k: string, v: string) { setValues((prev) => ({ ...prev, [k]: v })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErr(null);
    try {
      if (kind === "opportunity" || kind === "lead") {
        // Step 1: ensure customer
        let customer_id: string | undefined;
        if (values.customer_name) {
          const cr = await fetch("/api/customers", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ customer_name: values.customer_name, customer_phone: values.customer_phone ?? null }) });
          const cj = await cr.json();
          customer_id = cj.customer?.id;
        }
        const body = {
          customer_id,
          status: kind === "lead" ? "new" : "new",
          service_type: values.service_type,
          service_date: values.service_date || null,
          move_size: values.move_size,
          branch: values.branch_id ? null : null,
          opportunity_type: values.opportunity_type,
          source: values.source,
          amount: values.amount ? Number(values.amount) : 0,
        };
        const r = await fetch("/api/opportunities", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
        if (!r.ok) throw new Error((await r.json()).error ?? "failed");
      } else if (kind === "task") {
        const body = {
          title: values.title,
          due_at: values.due_at || null,
          type: values.type ?? "task",
          priority: values.priority ? Number(values.priority) : 3,
          related_type: values.related_type || null,
          related_id: values.related_id || null,
        };
        const r = await fetch("/api/tasks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
        if (!r.ok) throw new Error((await r.json()).error ?? "failed");
      } else {
        // follow_up: BOTH a task row and a calendar_events row
        const taskBody = {
          title: values.title,
          due_at: values.due_at || null,
          type: "follow_up",
          priority: values.priority ? Number(values.priority) : 3,
          related_type: values.related_type || null,
          related_id: values.related_id || null,
        };
        const tr = await fetch("/api/tasks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(taskBody) });
        if (!tr.ok) throw new Error((await tr.json()).error ?? "failed");
        const tj = await tr.json();
        if (values.due_at) {
          const start = new Date(values.due_at);
          const end = new Date(start.getTime() + 30 * 60_000);
          await fetch("/api/calendar-events", {
            method: "POST", headers: { "content-type": "application/json" },
            body: JSON.stringify({ kind: "office", event_type: "other", title: values.title, starts_at: start.toISOString(), ends_at: end.toISOString(), related_type: "task", related_id: tj.task?.id }),
          });
        }
      }
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-50" onClick={onClose} />
      <div className="fixed top-0 right-0 bottom-0 w-[480px] bg-background border-l border-border z-50 overflow-y-auto">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <div className="text-sm font-semibold">{cfg.title}</div>
          <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">Close</button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          {cfg.fields.map((f) => {
            const opts = f.type === "select" ? f.options : f.type === "remote_select" ? remoteOpts[f.key] ?? [] : null;
            return (
              <div key={f.key}>
                <label className="block text-xs font-medium mb-1">{f.label}{f.required && <span className="text-red-500"> *</span>}</label>
                {f.type === "text" && <input className="w-full border border-border rounded-md px-2 py-1.5 text-sm bg-background" required={f.required} value={values[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} />}
                {f.type === "number" && <input type="number" className="w-full border border-border rounded-md px-2 py-1.5 text-sm bg-background" value={values[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} />}
                {f.type === "date" && <input type="date" className="w-full border border-border rounded-md px-2 py-1.5 text-sm bg-background" value={values[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} />}
                {f.type === "datetime" && <input type="datetime-local" className="w-full border border-border rounded-md px-2 py-1.5 text-sm bg-background" value={values[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} />}
                {(f.type === "select" || f.type === "remote_select") && (
                  <select className="w-full border border-border rounded-md px-2 py-1.5 text-sm bg-background" value={values[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)}>
                    <option value="">—</option>
                    {(opts ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                )}
              </div>
            );
          })}
          {err && <div className="text-xs text-red-600">{err}</div>}
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={submitting} className="px-3 py-1.5 text-sm rounded-md bg-accent text-white disabled:opacity-50">{submitting ? "Saving…" : "Create"}</button>
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm rounded-md border border-border">Cancel</button>
          </div>
        </form>
      </div>
    </>
  );
}
