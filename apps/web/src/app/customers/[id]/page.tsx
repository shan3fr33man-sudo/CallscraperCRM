"use client";
import { use, useEffect, useState } from "react";
import { TopBar } from "@/components/TopBar";

type Customer = Record<string, unknown> & { id: string };
type Row = Record<string, unknown> & { id: string };
type Activity = { id: string; kind: string | null; body: string | null; created_at: string };

const TABS = ["Sales", "Estimate", "Storage", "Files", "Accounting", "Profitability", "Claims"] as const;
type Tab = typeof TABS[number];

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [tab, setTab] = useState<Tab>("Sales");
  const [opps, setOpps] = useState<Row[]>([]);
  const [jobs, setJobs] = useState<Row[]>([]);
  const [claims, setClaims] = useState<Row[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [actTab, setActTab] = useState<"all" | "note" | "email" | "call" | "text">("all");
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<Customer>>({});

  async function loadAll() {
    const [c, o, j, cl, a] = await Promise.all([
      fetch(`/api/customers/${id}`).then((r) => r.json()),
      fetch(`/api/opportunities?customer_id=${id}`).then((r) => r.json()).catch(() => ({ opportunities: [] })),
      fetch(`/api/jobs?customer_id=${id}`).then((r) => r.json()).catch(() => ({ jobs: [] })),
      fetch(`/api/claims?customer_id=${id}`).then((r) => r.json()).catch(() => ({ claims: [] })),
      fetch(`/api/activities?customer_id=${id}`).then((r) => r.json()).catch(() => ({ activities: [] })),
    ]);
    setCustomer(c.customer ?? null);
    setOpps(o.opportunities ?? []);
    setJobs(j.jobs ?? []);
    setClaims(cl.claims ?? []);
    setActivities(a.activities ?? []);
  }
  useEffect(() => { loadAll(); }, [id]);

  async function saveCustomer() {
    await fetch(`/api/customers/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(draft) });
    setEditing(false);
    setDraft({});
    loadAll();
  }

  async function addNote() {
    if (!note.trim()) return;
    await fetch("/api/activities", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "note", body: note, customer_id: id, related_type: "customer", related_id: id }) });
    setNote("");
    loadAll();
  }

  const filteredActivities = actTab === "all" ? activities : activities.filter((a) => a.kind === actTab);

  return (
    <div>
      <TopBar
        title={String(customer?.customer_name ?? "Customer")}
        aiContext={{
          page: "customers.detail",
          record_type: "customer",
          record_id: String(customer?.id ?? ""),
          record_name: String(customer?.customer_name ?? ""),
        }}
      />
      <div className="p-5 grid grid-cols-3 gap-5">
        {/* LEFT PANEL */}
        <div className="col-span-1 border border-border rounded-lg p-4 bg-background h-fit">
          <div className="text-lg font-semibold mb-1">{String(customer?.customer_name ?? "—")}</div>
          <div className="text-xs text-muted-foreground mb-3">{String(customer?.status ?? "—")}</div>
          {!editing ? (
            <div className="space-y-2 text-sm">
              <Field label="Phone" value={String(customer?.customer_phone ?? "—")} />
              <Field label="Email" value={String(customer?.customer_email ?? "—")} />
              <Field label="Source" value={String(customer?.source ?? "—")} />
              <Field label="Brand" value={String(customer?.brand ?? "—")} />
              <Field label="Balance" value={`$${String(customer?.balance ?? 0)}`} />
              <button onClick={() => { setDraft(customer ?? {}); setEditing(true); }} className="mt-2 text-xs px-3 py-1.5 rounded-md border border-border hover:bg-accent/10">Edit</button>
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              <Input label="Name" value={String(draft.customer_name ?? "")} onChange={(v) => setDraft({ ...draft, customer_name: v })} />
              <Input label="Phone" value={String(draft.customer_phone ?? "")} onChange={(v) => setDraft({ ...draft, customer_phone: v })} />
              <Input label="Email" value={String(draft.customer_email ?? "")} onChange={(v) => setDraft({ ...draft, customer_email: v })} />
              <Input label="Source" value={String(draft.source ?? "")} onChange={(v) => setDraft({ ...draft, source: v })} />
              <div className="flex gap-2 mt-2">
                <button onClick={saveCustomer} className="text-xs px-3 py-1.5 rounded-md bg-accent text-white">Save</button>
                <button onClick={() => { setEditing(false); setDraft({}); }} className="text-xs px-3 py-1.5 rounded-md border border-border">Cancel</button>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT PANEL */}
        <div className="col-span-2 space-y-4">
          <div className="border border-border rounded-lg bg-background">
            <div className="flex border-b border-border overflow-x-auto">
              {TABS.map((t) => (
                <button key={t} onClick={() => setTab(t)} className={`text-xs px-4 py-2.5 whitespace-nowrap ${tab === t ? "border-b-2 border-accent text-accent font-medium" : "text-muted-foreground"}`}>{t}</button>
              ))}
            </div>
            <div className="p-4 text-sm">
              {tab === "Sales" && <RowList rows={opps} columns={["status", "service_type", "service_date", "amount", "source"]} empty="No opportunities yet." />}
              {tab === "Estimate" && (
                <div className="space-y-3">
                  <DraftEstimateButton opportunityId={String(opps[0]?.id ?? "")} />
                  <RowList rows={opps.filter((o) => o.amount)} columns={["service_type", "service_date", "amount", "status"]} empty="No estimates drafted." />
                </div>
              )}
              {tab === "Storage" && <div className="text-xs text-muted-foreground">No storage accounts.</div>}
              {tab === "Files" && <div className="text-xs text-muted-foreground">No files uploaded.</div>}
              {tab === "Accounting" && <RowList rows={jobs} columns={["quote_number", "status", "service_date", "billed"]} empty="No billed jobs." />}
              {tab === "Profitability" && <div className="text-xs text-muted-foreground">Profitability rolls up after job close.</div>}
              {tab === "Claims" && <RowList rows={claims} columns={["status", "amount", "opened_at"]} empty="No claims filed." />}
            </div>
          </div>

          {/* ACTIVITY FEED */}
          <div className="border border-border rounded-lg bg-background p-4">
            <div className="text-xs font-medium mb-2">Activity</div>
            <div className="flex gap-1 mb-3">
              {(["all", "note", "email", "call", "text"] as const).map((t) => (
                <button key={t} onClick={() => setActTab(t)} className={`text-xs px-2 py-1 rounded-md border ${actTab === t ? "bg-accent text-white border-accent" : "border-border"}`}>{t}</button>
              ))}
            </div>
            <div className="flex gap-2 mb-3">
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note…" className="flex-1 text-xs border border-border rounded-md px-2 py-1.5 bg-background" />
              <button onClick={addNote} className="text-xs px-2 py-1.5 rounded-md bg-accent text-white">Add</button>
            </div>
            <div className="space-y-2">
              {filteredActivities.length === 0 && <div className="text-xs text-muted-foreground">No activity yet.</div>}
              {filteredActivities.map((a) => (
                <div key={a.id} className="border border-border rounded-md px-2 py-1.5">
                  <div className="text-[10px] text-muted-foreground">{a.kind} · {new Date(a.created_at).toLocaleString()}</div>
                  <div className="text-xs">{a.body}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div>{value}</div>
    </div>
  );
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div className="text-[10px] uppercase text-muted-foreground mb-0.5">{label}</div>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full text-xs border border-border rounded-md px-2 py-1.5 bg-background" />
    </div>
  );
}

function RowList({ rows, columns, empty }: { rows: Row[]; columns: string[]; empty: string }) {
  if (rows.length === 0) return <div className="text-xs text-muted-foreground">{empty}</div>;
  return (
    <div className="space-y-1">
      {rows.map((r) => (
        <div key={r.id} className="grid gap-2 text-xs border border-border rounded-md px-2 py-1.5" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
          {columns.map((c) => <div key={c}>{String(r[c] ?? "—")}</div>)}
        </div>
      ))}
    </div>
  );
}

function DraftEstimateButton({ opportunityId }: { opportunityId: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ estimate_id?: string; estimated_total?: number; confidence?: string; error?: string } | null>(null);

  async function run() {
    if (!opportunityId) {
      setResult({ error: "No opportunity to draft against." });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const r = await fetch("/api/agents/draft-estimate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ opportunity_id: opportunityId }),
      });
      const j = await r.json();
      setResult(j);
    } catch (e) {
      setResult({ error: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  const confColor =
    result?.confidence === "high" ? "bg-green-100 text-green-700 border-green-300" :
    result?.confidence === "medium" ? "bg-yellow-100 text-yellow-700 border-yellow-300" :
    result?.confidence === "low" ? "bg-red-100 text-red-700 border-red-300" : "";

  return (
    <div className="flex items-center gap-2 pb-2 border-b border-border">
      <button onClick={run} disabled={loading || !opportunityId} className="text-xs px-3 py-1.5 rounded-md bg-accent text-white disabled:opacity-50">
        {loading ? "Drafting…" : "Draft with AI"}
      </button>
      {result?.estimated_total != null && (
        <>
          <div className="text-xs">Drafted: <span className="font-semibold">${result.estimated_total}</span></div>
          {result.confidence && <span className={`text-[10px] px-2 py-0.5 rounded border ${confColor}`}>{result.confidence}</span>}
        </>
      )}
      {result?.error && <div className="text-xs text-red-600">{result.error}</div>}
    </div>
  );
}
