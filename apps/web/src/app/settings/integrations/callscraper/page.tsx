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
type StatusResp = { sync_state: SyncRow[]; upstream: { calls: number; call_summaries: number; leads: number } };

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

  const rowFor = (name: string) => data?.sync_state.find((r) => r.table_name === name);
  const connected = (data?.sync_state.length ?? 0) > 0;

  return (
    <div>
      <TopBar title="CallScraper Integration" />
      <div className="p-5 space-y-4">
        <div className="flex items-center gap-3">
          <span className={`inline-block w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-gray-400"}`} />
          <span className="text-xs font-medium">{connected ? "Connected" : "Not synced"}</span>
        </div>

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

        <div className="flex items-center gap-2 border border-border rounded-lg p-3 bg-background">
          <button onClick={() => runSync(false)} disabled={syncing} className="text-xs px-3 py-1.5 rounded-md bg-accent text-white disabled:opacity-50">{syncing ? "Syncing…" : "Sync Now"}</button>
          <button onClick={() => runSync(true)} disabled={syncing} className="text-xs px-3 py-1.5 rounded-md border border-border disabled:opacity-50">Full Reconcile</button>
          {msg && <div className="text-xs text-muted-foreground ml-2">{msg}</div>}
        </div>

        <div className="border border-border rounded-lg p-3 bg-background">
          <div className="text-xs font-medium mb-2">Upstream data available</div>
          <div className="text-xs text-muted-foreground">
            Calls: {data?.upstream.calls ?? "…"} · Summaries: {data?.upstream.call_summaries ?? "…"} · Leads: {data?.upstream.leads ?? "…"}
          </div>
        </div>
      </div>
    </div>
  );
}
