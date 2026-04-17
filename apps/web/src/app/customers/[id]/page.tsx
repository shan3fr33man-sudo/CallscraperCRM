"use client";
import { use, useEffect, useState } from "react";
import { TopBar } from "@/components/TopBar";

type Customer = Record<string, unknown> & { id: string };
type Row = Record<string, unknown> & { id: string };
type ActivityPayload = {
  external_id?: string;
  from_number?: string;
  to_number?: string;
  duration_seconds?: number;
  direction?: string;
  call_outcome?: string;
  brand?: string;
  started_at?: string;
  ended_at?: string;
  summary?: string;
  transcript?: string;
  sentiment?: string;
  intent?: string;
  move_type?: string;
  move_date?: string;
  price_quoted?: string | number;
  lead_quality?: string;
  key_details?: unknown;
  action_items?: unknown;
};
type Activity = {
  id: string;
  kind: string | null;
  body: string | null;
  payload: ActivityPayload | null;
  created_at: string;
  record_id?: string;
};

const TABS = ["Sales", "Estimate", "Storage", "Files", "Accounting", "Profitability", "Claims"] as const;
type Tab = (typeof TABS)[number];

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
  const callCount = activities.filter((a) => a.kind === "call").length;
  const noteCount = activities.filter((a) => a.kind === "note").length;

  // Parse address from customer data
  const addr = customer?.address_json as Record<string, string> | null;
  const originAddr = (() => {
    const first = opps[0];
    if (!first) return null;
    const o = first.origin_json as Record<string, string> | null;
    return o;
  })();
  const destAddr = (() => {
    const first = opps[0];
    if (!first) return null;
    const d = first.destination_json as Record<string, string> | null;
    return d;
  })();

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
        <div className="col-span-1 space-y-4">
          <div className="border border-border rounded-lg p-4 bg-background">
            <div className="text-lg font-semibold mb-1">{String(customer?.customer_name ?? "—")}</div>
            <div className="flex items-center gap-2 mb-3">
              <StatusBadge status={String(customer?.status ?? "active")} />
              {customer?.brand ? <BrandBadge brand={String(customer.brand)} /> : null}
            </div>
            {!editing ? (
              <div className="space-y-2 text-sm">
                <Field label="Phone" value={String(customer?.customer_phone ?? "—")} />
                <Field label="Email" value={String(customer?.customer_email ?? "—")} />
                <Field label="Source" value={String(customer?.source ?? "—")} />
                <Field label="Balance" value={`$${String(customer?.balance ?? 0)}`} />
                {addr && <Field label="Address" value={formatAddress(addr)} />}
                {customer?.tags && Array.isArray(customer.tags) && (customer.tags as string[]).length > 0 ? (
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground">Tags</div>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {(customer.tags as string[]).map((t) => (
                        <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent">{t}</span>
                      ))}
                    </div>
                  </div>
                ) : null}
                {customer?.created_at ? (
                  <Field label="Customer since" value={new Date(String(customer.created_at)).toLocaleDateString()} />
                ) : null}
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

          {/* Quick stats card */}
          <div className="border border-border rounded-lg p-4 bg-background">
            <div className="text-xs font-medium mb-2">Quick Stats</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-center p-2 rounded bg-blue-500/10">
                <div className="text-lg font-bold text-blue-400">{callCount}</div>
                <div className="text-[10px] text-muted-foreground">Calls</div>
              </div>
              <div className="text-center p-2 rounded bg-green-500/10">
                <div className="text-lg font-bold text-green-400">{opps.length}</div>
                <div className="text-[10px] text-muted-foreground">Opportunities</div>
              </div>
              <div className="text-center p-2 rounded bg-purple-500/10">
                <div className="text-lg font-bold text-purple-400">{jobs.length}</div>
                <div className="text-[10px] text-muted-foreground">Jobs</div>
              </div>
              <div className="text-center p-2 rounded bg-orange-500/10">
                <div className="text-lg font-bold text-orange-400">{noteCount}</div>
                <div className="text-[10px] text-muted-foreground">Notes</div>
              </div>
            </div>
          </div>

          {/* Move details from first opportunity */}
          {opps.length > 0 && (originAddr != null || destAddr != null || opps[0]?.move_type != null) ? (
            <div className="border border-border rounded-lg p-4 bg-background">
              <div className="text-xs font-medium mb-2">Move Details</div>
              <div className="space-y-2 text-sm">
                {opps[0]?.move_type != null ? <Field label="Move Type" value={String(opps[0].move_type)} /> : null}
                {opps[0]?.service_date != null ? <Field label="Service Date" value={String(opps[0].service_date)} /> : null}
                {opps[0]?.amount != null ? <Field label="Quoted" value={`$${Number(opps[0].amount).toLocaleString()}`} /> : null}
                {originAddr ? <Field label="Origin" value={formatAddress(originAddr)} /> : null}
                {destAddr ? <Field label="Destination" value={formatAddress(destAddr)} /> : null}
              </div>
            </div>
          ) : null}
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
              {tab === "Sales" && (
                <div className="space-y-2">
                  {opps.length === 0 && <div className="text-xs text-muted-foreground">No opportunities yet.</div>}
                  {opps.map((o) => (
                    <div key={o.id} className="border border-border rounded-md p-3 hover:bg-accent/5 transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={String(o.status ?? "new")} />
                          {o.service_type ? <span className="text-xs text-muted-foreground">{String(o.service_type)}</span> : null}
                        </div>
                        {o.amount ? <span className="text-sm font-semibold">${Number(o.amount).toLocaleString()}</span> : null}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {o.move_type ? <span>{String(o.move_type)}</span> : null}
                        {o.service_date ? <span>{String(o.service_date)}</span> : null}
                        {o.source ? <span>via {String(o.source)}</span> : null}
                        {o.lead_quality ? <LeadQualityBadge quality={String(o.lead_quality)} /> : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-medium">Activity</div>
              <div className="text-[10px] text-muted-foreground">{filteredActivities.length} items</div>
            </div>
            <div className="flex gap-1 mb-3">
              {(["all", "note", "email", "call", "text"] as const).map((t) => (
                <button key={t} onClick={() => setActTab(t)} className={`text-xs px-2 py-1 rounded-md border ${actTab === t ? "bg-accent text-white border-accent" : "border-border"}`}>
                  {t}{t === "call" ? ` (${callCount})` : t === "note" ? ` (${noteCount})` : ""}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mb-3">
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note…" className="flex-1 text-xs border border-border rounded-md px-2 py-1.5 bg-background" onKeyDown={(e) => e.key === "Enter" && addNote()} />
              <button onClick={addNote} className="text-xs px-2 py-1.5 rounded-md bg-accent text-white">Add</button>
            </div>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {filteredActivities.length === 0 && <div className="text-xs text-muted-foreground">No activity yet.</div>}
              {filteredActivities.map((a) =>
                a.kind === "call" ? (
                  <CallActivityCard key={a.id} activity={a} />
                ) : (
                  <div key={a.id} className="border border-border rounded-md px-3 py-2">
                    <div className="text-[10px] text-muted-foreground">{a.kind} · {new Date(a.created_at).toLocaleString()}</div>
                    <div className="text-xs mt-0.5">{a.body}</div>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Call Activity Card ─── */
function CallActivityCard({ activity }: { activity: Activity }) {
  const [expanded, setExpanded] = useState(false);
  const p = activity.payload ?? {};
  const dur = p.duration_seconds ?? 0;
  const mins = Math.floor(dur / 60);
  const secs = dur % 60;
  const isInbound = p.direction === "inbound";
  const callTime = p.started_at ? new Date(p.started_at).toLocaleString() : new Date(activity.created_at).toLocaleString();

  return (
    <div className="border border-border rounded-md overflow-hidden">
      {/* Header row */}
      <div className="px-3 py-2 flex items-center justify-between bg-background">
        <div className="flex items-center gap-2">
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${isInbound ? "bg-blue-500/15 text-blue-400" : "bg-orange-500/15 text-orange-400"}`}>
            {isInbound ? "IN" : "OUT"}
          </span>
          <span className="text-xs font-medium">{p.from_number ?? "Unknown"}</span>
          {p.to_number && <span className="text-[10px] text-muted-foreground">→ {p.to_number}</span>}
        </div>
        <div className="flex items-center gap-2">
          {dur > 0 && <span className="text-xs font-mono">{mins}:{String(secs).padStart(2, "0")}</span>}
          {p.call_outcome && <OutcomeBadge outcome={p.call_outcome} />}
        </div>
      </div>

      {/* Badges row */}
      <div className="px-3 py-1.5 flex items-center gap-1.5 flex-wrap border-t border-border/50">
        <span className="text-[10px] text-muted-foreground">{callTime}</span>
        {p.brand && <BrandBadge brand={p.brand} />}
        {p.sentiment && <SentimentBadge sentiment={p.sentiment} />}
        {p.lead_quality && <LeadQualityBadge quality={p.lead_quality} />}
        {p.intent && <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-400">{p.intent}</span>}
      </div>

      {/* Summary */}
      {p.summary && (
        <div className="px-3 py-2 border-t border-border/50">
          <div className="text-xs leading-relaxed">{p.summary}</div>
        </div>
      )}

      {/* Detail chips */}
      {(p.move_type || p.move_date || p.price_quoted) && (
        <div className="px-3 py-1.5 flex items-center gap-2 border-t border-border/50 flex-wrap">
          {p.move_type && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-400">
              {p.move_type}
            </span>
          )}
          {p.move_date && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">
              {p.move_date}
            </span>
          )}
          {p.price_quoted && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-400">
              ${String(p.price_quoted)}
            </span>
          )}
        </div>
      )}

      {/* Key details */}
      {p.key_details != null && typeof p.key_details === "object" ? (
        <div className="px-3 py-1.5 border-t border-border/50">
          <div className="text-[10px] text-muted-foreground">
            {Array.isArray(p.key_details)
              ? (p.key_details as string[]).slice(0, 3).join(" · ")
              : Object.entries(p.key_details as Record<string, unknown>).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(" · ")}
          </div>
        </div>
      ) : null}

      {/* Expandable transcript */}
      {p.transcript && (
        <div className="border-t border-border/50">
          <button onClick={() => setExpanded(!expanded)} className="w-full px-3 py-1.5 text-[10px] text-muted-foreground hover:text-foreground text-left flex items-center gap-1">
            <span>{expanded ? "▾" : "▸"}</span> Transcript
          </button>
          {expanded && (
            <div className="px-3 pb-2 text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap max-h-60 overflow-y-auto">
              {p.transcript}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Badge components ─── */
function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    new: "bg-blue-500/15 text-blue-400",
    active: "bg-green-500/15 text-green-400",
    won: "bg-emerald-500/15 text-emerald-400",
    lost: "bg-red-500/15 text-red-400",
    booked: "bg-green-500/15 text-green-400",
    closed: "bg-gray-500/15 text-gray-400",
  };
  return <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${colors[status.toLowerCase()] ?? "bg-gray-500/15 text-gray-400"}`}>{status}</span>;
}

function BrandBadge({ brand }: { brand: string }) {
  const colors: Record<string, string> = {
    APM: "bg-blue-500/15 text-blue-400",
    AFM: "bg-orange-500/15 text-orange-400",
  };
  return <span className={`text-[10px] px-1.5 py-0.5 rounded ${colors[brand] ?? "bg-gray-500/15 text-gray-400"}`}>{brand}</span>;
}

function SentimentBadge({ sentiment }: { sentiment: string }) {
  const colors: Record<string, string> = {
    positive: "bg-green-500/15 text-green-400",
    neutral: "bg-gray-500/15 text-gray-400",
    negative: "bg-red-500/15 text-red-400",
    mixed: "bg-yellow-500/15 text-yellow-400",
  };
  return <span className={`text-[10px] px-1.5 py-0.5 rounded ${colors[sentiment.toLowerCase()] ?? "bg-gray-500/15 text-gray-400"}`}>{sentiment}</span>;
}

function LeadQualityBadge({ quality }: { quality: string }) {
  const colors: Record<string, string> = {
    hot: "bg-red-500/15 text-red-400",
    warm: "bg-orange-500/15 text-orange-400",
    cold: "bg-blue-500/15 text-blue-400",
  };
  return <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${colors[quality.toLowerCase()] ?? "bg-gray-500/15 text-gray-400"}`}>{quality}</span>;
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  const colors: Record<string, string> = {
    connected: "bg-green-500/15 text-green-400",
    voicemail: "bg-yellow-500/15 text-yellow-400",
    no_answer: "bg-red-500/15 text-red-400",
    missed: "bg-red-500/15 text-red-400",
    busy: "bg-orange-500/15 text-orange-400",
  };
  return <span className={`text-[10px] px-1.5 py-0.5 rounded ${colors[outcome.toLowerCase()] ?? "bg-gray-500/15 text-gray-400"}`}>{outcome}</span>;
}

/* ─── Helpers ─── */
function formatAddress(addr: Record<string, string>): string {
  const parts = [addr.street, addr.city, addr.state, addr.zip].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "—";
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
