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

const TICKET_TYPES = ["damage", "service_complaint", "billing", "inquiry", "compliment", "other"].map((v) => ({ value: v, label: v }));
const TICKET_PRIORITIES = [{ value: "1", label: "low" }, { value: "2", label: "medium" }, { value: "3", label: "high" }, { value: "4", label: "critical" }];

const ESTIMATE_FIELDS: Field[] = [
  { key: "opportunity_id", label: "Opportunity", type: "remote_select", endpoint: "/api/opportunities", valueKey: "id", labelKey: "customer_name", required: true },
  { key: "line_items", label: "Line Items", type: "line_items", required: true },
  { key: "discount", label: "Discount ($)", type: "number" },
  { key: "sales_tax_pct", label: "Sales Tax %", type: "number" },
  { key: "notes", label: "Notes", type: "textarea" },
  { key: "valid_until", label: "Valid until", type: "date" },
];

const CREW_CONFIRMATION_FIELDS: Field[] = [
  { key: "job_id", label: "Job", type: "remote_select", endpoint: "/api/jobs", valueKey: "id", labelKey: "customer_name", required: true },
  { key: "crew_member_id", label: "Crew member", type: "remote_select", endpoint: "/api/crews", valueKey: "id", labelKey: "name", required: true },
  { key: "report_time", label: "Report time", type: "datetime", required: true },
  { key: "pickup_location", label: "Pickup location", type: "text" },
  { key: "special_instructions", label: "Special instructions", type: "textarea" },
  { key: "send_sms", label: "Send SMS notification", type: "checkbox" },
];

const TICKET_FIELDS: Field[] = [
  { key: "customer", label: "Customer", type: "customer_autocomplete", required: true },
  { key: "job_id", label: "Job (optional)", type: "remote_select", endpoint: "/api/jobs", valueKey: "id", labelKey: "quote_number" },
  { key: "ticket_name", label: "Ticket name", type: "text", required: true },
  { key: "type", label: "Type", type: "select", options: TICKET_TYPES },
  { key: "priority", label: "Priority", type: "select", options: TICKET_PRIORITIES },
  { key: "assigned_to", label: "Assigned to", type: "text" },
];

function configFor(kind: FormKind): { title: string; fields: Field[] } {
  if (kind === "opportunity") return { title: "New Opportunity", fields: OPP_FIELDS };
  if (kind === "lead") return { title: "New Lead", fields: [...OPP_FIELDS, { key: "run_triage", label: "Run Lead Triage after create", type: "checkbox" }] };
  if (kind === "task") return { title: "New Task", fields: TASK_FIELDS };
  if (kind === "follow_up") return { title: "New Follow-up", fields: FOLLOWUP_FIELDS };
  if (kind === "estimate") return { title: "New Estimate", fields: ESTIMATE_FIELDS };
  if (kind === "crew_confirmation") return { title: "Crew Confirmation", fields: CREW_CONFIRMATION_FIELDS };
  return { title: "New Ticket", fields: TICKET_FIELDS };
}

export function RecordForm({ kind, onClose, prefill }: { kind: FormKind; onClose: () => void; prefill?: Record<string, string> }) {
  const cfg = configFor(kind);
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(prefill ?? {});
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [remoteOpts, setRemoteOpts] = useState<Record<string, { value: string; label: string }[]>>({});

  useEffect(() => {
    cfg.fields.forEach(async (f) => {
      if (f.type !== "remote_select") return;
      try {
        const r = await fetch(f.endpoint);
        const j = await r.json();
        const rows = (j.branches ?? j.users ?? j.opportunities ?? j.jobs ?? j.crews ?? j.customers ?? []) as Record<string, unknown>[];
        const arr = rows.map((row) => ({ value: String(row[f.valueKey]), label: String(row[f.labelKey] ?? row[f.valueKey]) }));
        setRemoteOpts((prev) => ({ ...prev, [f.key]: arr }));
      } catch {}
    });
  }, [kind]);

  function set(k: string, v: string) { setValues((prev) => ({ ...prev, [k]: v })); }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    for (const f of cfg.fields) {
      const v = values[f.key] ?? "";
      if (f.type === "customer_autocomplete") {
        if (f.required && !values.customer_id) errs[f.key] = "Customer is required";
        continue;
      }
      if (f.required && !v.trim()) { errs[f.key] = "This field is required"; continue; }
      if (f.type === "text" && "minLength" in f && f.minLength && v.length < f.minLength) errs[f.key] = `Must be at least ${f.minLength} characters`;
      if (f.type === "phone" && v && v.replace(/\D/g, "").length < 10) errs[f.key] = "Enter a valid phone number";
      if (f.type === "number" && v) {
        const n = Number(v);
        if ("min" in f && f.min !== undefined && n < f.min) errs[f.key] = `Must be ≥ ${f.min}`;
        if ("max" in f && f.max !== undefined && n > f.max) errs[f.key] = `Must be ≤ ${f.max}`;
      }
      if (f.type === "datetime" && v && f.key === "due_at") {
        if (new Date(v).getTime() < Date.now() - 60_000) errs[f.key] = "Date must be in the future";
      }
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
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
          // Mirror the task's assigned_to onto the paired calendar event's
          // owner_id so /calendars/{mine,team} can filter by "this person's"
          // events without a join. When assigned_to is null (current default
          // for follow-ups), owner_id stays null too and the event still
          // appears on the team calendar — just not under any specific user.
          await fetch("/api/calendar-events", {
            method: "POST", headers: { "content-type": "application/json" },
            body: JSON.stringify({
              kind: "office",
              event_type: "other",
              title: values.title,
              starts_at: start.toISOString(),
              ends_at: end.toISOString(),
              related_type: "task",
              related_id: tj.task?.id,
              owner_id: tj.task?.assigned_to ?? null,
            }),
          }).catch((e) => console.error("calendar-events follow-up step 2 failed:", e));
        }
        onClose();
        router.push("/tasks/open");
        return;
      } else if (kind === "estimate") {
        const items = JSON.parse(values.line_items || "[]") as { name: string; rate: number; qty: number; subtotal: number }[];
        const subtotal = items.reduce((s, i) => s + (Number(i.subtotal) || 0), 0);
        const discount = Number(values.discount || 0);
        const afterDiscount = subtotal - discount;
        const taxPct = Number(values.sales_tax_pct || 0);
        const sales_tax = afterDiscount * (taxPct / 100);
        const total = afterDiscount + sales_tax;
        const r = await fetch("/api/estimates", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({
            opportunity_id: values.opportunity_id,
            charges_json: items,
            subtotal,
            discounts: discount,
            sales_tax,
            estimated_total: total,
            amount: total,
            valid_until: values.valid_until || null,
            notes: values.notes || null,
          }),
        });
        if (!r.ok) throw new Error((await r.json()).error ?? "failed");
        const ej = await r.json();
        if (values.save_and_send === "true" && ej.estimate?.id) {
          await fetch(`/api/estimates/${ej.estimate.id}/send`, { method: "POST" }).catch(() => null);
        }
        onClose();
        return;
      } else if (kind === "crew_confirmation") {
        const taskBody = {
          type: "crew_confirmation",
          title: `Crew confirmation: job ${values.job_id}`,
          due_at: values.report_time || null,
          assigned_to: values.crew_member_id || null,
          related_type: "job",
          related_id: values.job_id,
          body: values.special_instructions || null,
        };
        const tr = await fetch("/api/tasks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(taskBody) });
        if (!tr.ok) throw new Error((await tr.json()).error ?? "failed");
        if (values.send_sms !== "false") {
          await fetch("/api/messages/send", {
            method: "POST", headers: { "content-type": "application/json" },
            body: JSON.stringify({ template_key: "crew_confirmation", related_type: "job", related_id: values.job_id }),
          }).catch(() => null);
        }
        onClose();
        return;
      } else if (kind === "ticket") {
        const r = await fetch("/api/tickets", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({
            customer_id: values.customer_id,
            job_id: values.job_id || null,
            ticket_name: values.ticket_name,
            type: values.type,
            priority: values.priority ? Number(values.priority) : 3,
            assigned_to: values.assigned_to || null,
            status: "active",
          }),
        });
        if (!r.ok) throw new Error((await r.json()).error ?? "failed");
        onClose();
        router.push("/customer-service/tickets/active");
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
          {err && (
            <div className="flex items-start justify-between gap-2 p-2 rounded-md bg-red-50 border border-red-300 text-red-700 text-xs">
              <span>Could not save. {err}</span>
              <button type="button" onClick={() => setErr(null)} className="font-bold">×</button>
            </div>
          )}
          <fieldset disabled={submitting} className="space-y-3">
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
                {f.type === "line_items" && (
                  <LineItemsEditor value={values[f.key] ?? "[]"} onChange={(v) => set(f.key, v)} />
                )}
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
                {fieldErrors[f.key] && <div className="text-[10px] text-red-600 mt-0.5">{fieldErrors[f.key]}</div>}
              </div>
            );
          })}
          </fieldset>
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={submitting} className="px-3 py-1.5 text-sm rounded-md bg-accent text-white disabled:opacity-50">{submitting ? "Saving…" : "Create"}</button>
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm rounded-md border border-border">Cancel</button>
          </div>
        </form>
      </div>
    </>
  );
}

type LineItem = { name: string; rate: number; qty: number; subtotal: number };
function LineItemsEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  let parsed: LineItem[] = [];
  try { parsed = JSON.parse(value) as LineItem[]; } catch { parsed = []; }
  const items = parsed.length ? parsed : [];
  function update(next: LineItem[]) { onChange(JSON.stringify(next)); }
  function setCell(i: number, patch: Partial<LineItem>) {
    const next = items.map((it, idx) => idx === i ? { ...it, ...patch, subtotal: Number((patch.rate ?? it.rate) || 0) * Number((patch.qty ?? it.qty) || 0) } : it);
    update(next);
  }
  return (
    <div className="space-y-1">
      {items.map((it, i) => (
        <div key={i} className="flex gap-1 items-center">
          <input value={it.name} onChange={(e) => setCell(i, { name: e.target.value })} placeholder="Name" className="flex-1 border border-border rounded-md px-2 py-1 text-xs bg-background" />
          <input type="number" value={it.rate} onChange={(e) => setCell(i, { rate: Number(e.target.value) })} placeholder="Rate" className="w-20 border border-border rounded-md px-2 py-1 text-xs bg-background" />
          <input type="number" value={it.qty} onChange={(e) => setCell(i, { qty: Number(e.target.value) })} placeholder="Qty" className="w-16 border border-border rounded-md px-2 py-1 text-xs bg-background" />
          <div className="w-16 text-xs text-right">${it.subtotal.toFixed(2)}</div>
          <button type="button" onClick={() => update(items.filter((_, idx) => idx !== i))} className="text-red-600 px-1">×</button>
        </div>
      ))}
      <button type="button" onClick={() => update([...items, { name: "", rate: 0, qty: 1, subtotal: 0 }])} className="text-xs px-2 py-1 rounded-md border border-border">+ Add Line</button>
      <div className="text-xs text-right text-muted-foreground">Subtotal: ${items.reduce((s, it) => s + (it.subtotal || 0), 0).toFixed(2)}</div>
    </div>
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
