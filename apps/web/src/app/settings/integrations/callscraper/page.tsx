"use client";
import { useEffect, useState } from "react";
import { TopBar } from "@/components/TopBar";

type SyncRow = {
  table_name: string;
  cursor: string | null;
  rows_synced: number | null;
  last_run_at: string | null;
  status: string | null;
  error: string | null;
};
type StatusResp = {
  sync_state: SyncRow[];
  upstream: { calls: number; call_summaries: number; leads: number };
  crm: { customers: number; activities: number; opportunities: number };
};

function relTime(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const ENTITIES = ["calls", "call_summaries", "leads"] as const;

export default function CallscraperIntegrationPage() {
  const [data, setData] = useState<StatusResp | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [restKey, setRestKey] = useState("");
  const [restStatus, setRestStatus] = useState<string | null>(null);
  const [restTesting, setRestTesting] = useState(false);

  async function load() {
    const r = await fetch("/api/sync/status");
    setData(await r.json());
  }
  useEffect(() => { load(); }, []);

  async function runSync(full: boolean) {
    if (full && !confirm("This will re-sync all historical data. May take several minutes. Continue?")) return;
    setSyncing(true); setMsg(null);
    try {
      const r = await fetch(`/api/sync/callscraper${full ? "?full=true" : ""}`, { method: "POST" });
      const j = await r.json();
      if (j.ok) setMsg(`Synced ${j.total_rows} rows across ${j.results?.length ?? 0} entities.`);
      else setMsg(`Error: ${j.error ?? "unknown"}`);
    } catch (e) { setMsg(`Error: ${(e as Error).message}`); }
    finally { setSyncing(false); load(); }
  }

  async function saveRestKey() {
    if (!restKey.trim()) return;
    try {
      const r = await fetch("/api/settings/api-keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider: "callscraper", key: restKey.trim() }),
      });
      const j = await r.json();
      if (j.ok) { setRestStatus("Key saved"); setRestKey(""); }
      else setRestStatus(`Error: ${j.error}`);
    } catch (e) { setRestStatus(`Error: ${(e as Error).message}`); }
  }

  async function testRestConnection() {
    setRestTesting(true); setRestStatus(null);
    try {
      const r = await fetch("/api/sync/callscraper/test-rest");
      const j = await r.json();
      if (j.ok) setRestStatus(`Connected (${j.latency_ms}ms)`);
      else if (j.status === "not_configured") setRestStatus("No API key configured");
      else setRestStatus(`Unreachable: ${j.error ?? "unknown"}`);
    } catch (e) { setRestStatus(`Error: ${(e as Error).message}`); }
    finally { setRestTesting(false); }
  }

  const rowFor = (name: string) => data?.sync_state.find((r) => r.table_name === name);
  const connected = (data?.sync_state.length ?? 0) > 0;

  return (
    <div>
      <TopBar title="CallScraper Integration" />
      <div className="p-5 space-y-4">

        {/* Connection status */}
        <div className="flex items-center gap-3">
          <span className={`inline-block w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-gray-400"}`} />
          <span className="text-xs font-medium">{connected ? "Connected (Direct Supabase)" : "Not synced"}</span>
        </div>

        {/* Per-entity sync cards */}
        <div className="grid grid-cols-3 gap-3">
          {ENTITIES.map((e) => {
            const r = rowFor(e);
            const status = r?.status ?? "pending";
            const color = status === "ok" ? "bg-green-500" : status === "error" ? "bg-red-500" : "bg-gray-400";
            return (
              <div key={e} className="border border-border rounded-lg p-3 bg-background">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-medium capitalize">{e.replace("_", " ")}</div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full text-white ${color}`}>{status}</span>
                </div>
                <div className="text-[10px] text-muted-foreground">Last sync: {relTime(r?.last_run_at ?? null)}</div>
                <div className="text-[10px] text-muted-foreground">Rows: {r?.rows_synced ?? 0}</div>
                {r?.error && <div className="text-[10px] text-red-600 mt-1 break-all">{r.error}</div>}
              </div>
            );
          })}
        </div>

        {/* Sync controls */}
        <div className="flex items-center gap-2 border border-border rounded-lg p-3 bg-background">
          <button onClick={() => runSync(false)} disabled={syncing} className="text-xs px-3 py-1.5 rounded-md bg-accent text-white disabled:opacity-50">{syncing ? "Syncing..." : "Sync Now"}</button>
          <button onClick={() => runSync(true)} disabled={syncing} className="text-xs px-3 py-1.5 rounded-md border border-border disabled:opacity-50">Full Reconcile</button>
          {msg && <div className="text-xs text-muted-foreground ml-2">{msg}</div>}
        </div>

        {/* Upstream data counts */}
        <div className="border border-border rounded-lg p-3 bg-background">
          <div className="text-xs font-medium mb-2">Upstream callscraper.com</div>
          <div className="text-xs text-muted-foreground">
            Calls: {data?.upstream.calls ?? "..."} · Summaries: {data?.upstream.call_summaries ?? "..."} · Leads: {data?.upstream.leads ?? "..."}
          </div>
        </div>

        {/* CRM data counts */}
        <div className="border border-border rounded-lg p-3 bg-background">
          <div className="text-xs font-medium mb-2">CRM data (synced)</div>
          <div className="text-xs text-muted-foreground">
            Customers: {data?.crm?.customers ?? "..."} · Call Activities: {data?.crm?.activities ?? "..."} · Opportunities: {data?.crm?.opportunities ?? "..."}
          </div>
        </div>

        {/* REST API Configuration */}
        <div className="border border-border rounded-lg p-4 bg-background space-y-3">
          <div>
            <div className="text-xs font-medium mb-1">CallScraper REST API</div>
            <div className="text-[10px] text-muted-foreground">
              Optional: connect via REST API alongside the direct Supabase sync.
              The REST API is not yet available — configure your key here so it connects automatically when launched.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="password"
              value={restKey}
              onChange={(e) => setRestKey(e.target.value)}
              placeholder="Enter CallScraper API key"
              className="flex-1 text-xs px-2 py-1.5 rounded-md border border-border bg-background"
            />
            <button onClick={saveRestKey} disabled={!restKey.trim()} className="text-xs px-3 py-1.5 rounded-md bg-accent text-white disabled:opacity-50">Save</button>
            <button onClick={testRestConnection} disabled={restTesting} className="text-xs px-3 py-1.5 rounded-md border border-border disabled:opacity-50">
              {restTesting ? "Testing..." : "Test Connection"}
            </button>
          </div>
          {restStatus && (
            <div className={`text-[10px] ${restStatus.startsWith("Error") || restStatus.startsWith("Unreachable") ? "text-red-600" : restStatus.startsWith("Connected") || restStatus === "Key saved" ? "text-green-600" : "text-muted-foreground"}`}>
              {restStatus}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
