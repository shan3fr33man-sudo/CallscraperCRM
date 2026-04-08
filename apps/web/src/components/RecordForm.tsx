"use client";
// RecordForm contract — form kinds:
//   opportunity, lead, task, follow_up  (existed pre-Phase F; hardened in F2)
//   estimate                            (added in F4)
//   crew_confirmation                   (added in F4)
//   ticket                              (added in F4)
// Field types: text, number, date, datetime, select, remote_select,
//   customer_autocomplete (F3), textarea (F4), checkbox (F4), line_items (F4)
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export type FormKind = "opportunity" | "lead" | "task" | "follow_up" | "estimate" | "crew_confirmation" | "ticket";

type Field =
  | { key: string; label: string; type: "text" | "number" | "date" | "datetime" | "textarea" | "phone"; required?: boolean; min?: number; max?: number; minLength?: number }
  | { key: string; label: string; type: "checkbox"; required?: boolean }
  | { key: string; label: string; type: "select"; options: { value: string; label: string }[]; required?: boolean }
  | { key: string; label: string; type: "remote_select"; endpoint: string; valueKey: string; labelKey: string; required?: boolean }
  | { key: string; label: string; type: "customer_autocomplete"; required?: boolean }
  | { key: string; label: string; type: "line_items"; required?: boolean };

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
  { key: "customer", label: "Customer", type: "customer_autocomplete", required: true },
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

export function RecordForm({ kind, onClose, prefill }: { kind: FormKind; onClose: () => void; prefill?: Record<string, string> }) {
  const cfg = configFor(kind);
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(prefill ?? {});
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
        let customer_id: string | undefined = values.customer_id || undefined;
        if (!customer_id && values.customer_name) {
          const cr = await fetch("/api/customers", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ customer_name: values.customer_name, customer_phone: values.customer_phone ?? null }) });
          const cj = await cr.json();
          customer_id = cj.customer?.id;
        }
        const body = {
          customer_id,
          customer_name: values.customer_name,
          customer_phone: values.customer_phone,
          status: "new",
          service_type: values.service_type,
          service_date: values.service_date || null,
          move_size: values.move_size,
          origin_address: values.origin_address,
          destination_address: values.destination_address,
          branch_id: values.branch_id || null,
          opportunity_type: values.opportunity_type,
          source: values.source,
          assigned_to: values.assigned_to || null,
          amount: values.amount ? Number(values.amount) : 0,
        };
        const r = await fetch("/api/opportunities", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
        if (!r.ok) throw new Error((await r.json()).error ?? "failed");
        if (kind === "lead" && values.run_triage !== "false") {
          const rj = await r.json().catch(() => null);
          if (rj?.opportunity?.id) {
            fetch(`/api/agents/analyze-call?lead_triage=true&opportunity_id=${rj.opportunity.id}`, { method: "POST" }).catch(() => null);
          }
        }
        onClose();
        router.push("/sales/new-leads");
        return;
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
        onClose();
        const today = new Date().toISOString().slice(0, 10);
        router.push(values.due_at?.slice(0, 10) === today ? "/tasks/due-today" : "/tasks/open");
        return;
      } else if (kind === "follow_up") {
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
          }).catch((e) => console.error("calendar-events follow-up step 2 failed:", e));
        }
        onClose();
        router.push("/tasks/open");
        return;
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
                {f.type === "textarea" && <textarea rows={3} className="w-full border border-border rounded-md px-2 py-1.5 text-sm bg-background" value={values[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} />}
                {f.type === "phone" && <input type="tel" className="w-full border border-border rounded-md px-2 py-1.5 text-sm bg-background" value={values[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} />}
                {f.type === "checkbox" && <input type="checkbox" checked={values[f.key] !== "false"} onChange={(e) => set(f.key, e.target.checked ? "true" : "false")} />}
                {f.type === "customer_autocomplete" && (
                  <CustomerAutocomplete
                    customerId={values.customer_id ?? ""}
                    customerName={values.customer_name ?? ""}
                    onPick={(id, name, phone) => { set("customer_id", id); set("customer_name", name); if (phone) set("customer_phone", phone); }}
                    onClear={() => { set("customer_id", ""); set("customer_name", ""); set("customer_phone", ""); }}
                  />
                )}
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

type CustomerHit = { id: string; customer_name: string | null; customer_phone: string | null };
function CustomerAutocomplete({ customerId, customerName, onPick, onClear }: { customerId: string; customerName: string; onPick: (id: string, name: string, phone?: string) => void; onClear: () => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<CustomerHit[]>([]);
  const [open, setOpen] = useState(false);
  const [miniOpen, setMiniOpen] = useState(false);
  const [miniName, setMiniName] = useState("");
  const [miniPhone, setMiniPhone] = useState("");

  useEffect(() => {
    if (!q.trim()) { setHits([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/customers?q=${encodeURIComponent(q)}`);
        const j = await r.json();
        setHits(j.customers ?? []);
      } catch { setHits([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  async function createInline() {
    if (!miniName.trim()) return;
    const r = await fetch("/api/customers", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ customer_name: miniName, customer_phone: miniPhone || null }) });
    const j = await r.json();
    if (j.customer?.id) {
      onPick(j.customer.id, j.customer.customer_name ?? miniName, j.customer.customer_phone ?? miniPhone);
      setMiniOpen(false); setMiniName(""); setMiniPhone(""); setQ(""); setOpen(false);
    }
  }

  if (customerId) {
    return (
      <div className="inline-flex items-center gap-2 px-2 py-1 rounded-md bg-green-100 text-green-800 text-xs border border-green-300">
        <span>{customerName || "selected"}</span>
        <button type="button" onClick={onClear} className="text-green-900 font-bold">×</button>
      </div>
    );
  }
  return (
    <div className="relative">
      <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder="Search by name or phone…" className="w-full border border-border rounded-md px-2 py-1.5 text-sm bg-background" />
      {open && (q.trim() || hits.length > 0) && (
        <div className="absolute z-10 left-0 right-0 mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
          {hits.map((h) => (
            <button type="button" key={h.id} onClick={() => { onPick(h.id, h.customer_name ?? "", h.customer_phone ?? undefined); setQ(""); setOpen(false); }} className="w-full text-left px-2 py-1.5 text-xs hover:bg-accent/10">
              <div className="font-medium">{h.customer_name ?? "—"}</div>
              <div className="text-muted-foreground">{h.customer_phone ?? ""}</div>
            </button>
          ))}
          {q.trim() && !miniOpen && (
            <button type="button" onClick={() => { setMiniOpen(true); setMiniName(q); }} className="w-full text-left px-2 py-1.5 text-xs border-t border-border hover:bg-accent/10 text-accent">
              + Create new: {q}
            </button>
          )}
          {miniOpen && (
            <div className="p-2 border-t border-border space-y-1">
              <input value={miniName} onChange={(e) => setMiniName(e.target.value)} placeholder="Name" className="w-full border border-border rounded-md px-2 py-1 text-xs bg-background" />
              <input value={miniPhone} onChange={(e) => setMiniPhone(e.target.value)} placeholder="Phone" className="w-full border border-border rounded-md px-2 py-1 text-xs bg-background" />
              <div className="flex gap-1">
                <button type="button" onClick={createInline} className="text-xs px-2 py-1 rounded-md bg-accent text-white">Create</button>
                <button type="button" onClick={() => setMiniOpen(false)} className="text-xs px-2 py-1 rounded-md border border-border">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
