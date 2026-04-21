"use client";
import { useEffect, useState } from "react";
import { TopBar } from "@/components/TopBar";
import { ErrorBanner } from "@/components/ui";

type Call = {
  id: string;
  caller_name: string | null;
  from_number: string | null;
  duration_seconds: number | null;
  call_outcome: string | null;
  brand: string | null;
  direction: string | null;
  started_at: string | null;
  lead_quality: string | null;
  intent: string | null;
  move_type: string | null;
  move_date: string | null;
  price_quoted: number | null;
};

type Opp = Record<string, unknown> & { id: string; status?: string; assigned_to?: string };

const QUALITY_COLORS: Record<string, string> = {
  hot: "bg-red-100 text-red-700 border-red-300",
  warm: "bg-orange-100 text-orange-700 border-orange-300",
  cold: "bg-blue-100 text-blue-700 border-blue-300",
};

export default function SalesCommandCenter() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [opps, setOpps] = useState<Opp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const [cr, or] = await Promise.all([
        fetch("/api/calls/recent").then((r) => r.json()),
        fetch("/api/opportunities").then((r) => r.json()),
      ]);
      // Still allow partial success on one side — surface only if both fail
      if (cr.error && or.error) {
        setError(`${cr.error}; ${or.error}`);
      } else {
        setCalls(cr.calls ?? []);
        setOpps(or.opportunities ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load sales data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);

  async function createOppFromCall(c: Call) {
    await fetch("/api/opportunities", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        status: "new",
        source: "phone",
        brand: c.brand,
        move_type: c.move_type,
        service_date: c.move_date,
        amount: c.price_quoted ?? 0,
        lead_quality: c.lead_quality,
      }),
    });
    load();
  }

  // Funnel
  const funnel = {
    calls: calls.length,
    leads: opps.filter((o) => o.status === "new").length,
    quoted: opps.filter((o) => o.status === "quoted").length,
    booked: opps.filter((o) => o.status === "booked").length,
  };

  // Leaderboard: prefer assigned_to, fall back to brand grouping (until real assignments exist)
  const board = new Map<string, number>();
  let hasAssignments = false;
  opps.forEach((o) => {
    if (o.assigned_to) hasAssignments = true;
  });
  if (hasAssignments) {
    opps.forEach((o) => {
      if (o.status === "booked" && o.assigned_to) {
        board.set(String(o.assigned_to), (board.get(String(o.assigned_to)) ?? 0) + 1);
      }
    });
  } else {
    calls.forEach((c) => {
      const key = c.brand ?? "unknown";
      board.set(key, (board.get(key) ?? 0) + 1);
    });
  }
  const leaders = Array.from(board.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);

  return (
    <div>
      <TopBar title="Sales Command Center" />
      <div className="p-5">
        {error ? (
          <div className="mb-4">
            <ErrorBanner message={error} onRetry={load} />
          </div>
        ) : null}
        <div className="grid grid-cols-3 gap-4">
        {/* LEFT: Live calls */}
        <div className="border border-border rounded-lg bg-background overflow-hidden">
          <div className="px-4 py-2 border-b border-border flex items-center justify-between">
            <div className="text-xs font-medium">Live Call Feed</div>
            <div className="text-[10px] text-muted-foreground">{loading ? "loading…" : `${calls.length} recent`}</div>
          </div>
          <div className="divide-y divide-border max-h-[70vh] overflow-y-auto">
            {calls.length === 0 && <div className="p-4 text-xs text-muted-foreground">No recent calls. Connect callscraper.com in Settings → Integrations.</div>}
            {calls.map((c) => (
              <div key={c.id} className="p-3 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="font-medium truncate">{c.caller_name ?? c.from_number ?? "Unknown"}</div>
                  <div className="text-[10px] text-muted-foreground">{c.started_at ? new Date(c.started_at).toLocaleTimeString() : ""}</div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {c.lead_quality && <span className={`text-[10px] px-1.5 py-0.5 rounded border ${QUALITY_COLORS[c.lead_quality] ?? "bg-gray-100 text-gray-700 border-gray-300"}`}>{c.lead_quality}</span>}
                  {c.intent && <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent">{c.intent}</span>}
                  {c.move_type && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted">{c.move_type}</span>}
                  {c.brand && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted">{c.brand}</span>}
                </div>
                <div className="text-[10px] text-muted-foreground">{c.duration_seconds ?? 0}s · {c.call_outcome ?? "—"} · {c.move_date ?? ""}</div>
                <button onClick={() => createOppFromCall(c)} className="text-[10px] px-2 py-1 rounded-md bg-accent text-white">Create Opportunity</button>
              </div>
            ))}
          </div>
        </div>

        {/* CENTER: Funnel */}
        <div className="border border-border rounded-lg bg-background p-4">
          <div className="text-xs font-medium mb-3">Conversion Funnel</div>
          <div className="space-y-3">
            {[
              { label: "Calls", value: funnel.calls, max: funnel.calls || 1, color: "bg-blue-500" },
              { label: "Leads", value: funnel.leads, max: funnel.calls || 1, color: "bg-indigo-500" },
              { label: "Quoted", value: funnel.quoted, max: funnel.calls || 1, color: "bg-purple-500" },
              { label: "Booked", value: funnel.booked, max: funnel.calls || 1, color: "bg-green-500" },
            ].map((s) => (
              <div key={s.label}>
                <div className="flex justify-between text-xs mb-1"><span>{s.label}</span><span className="font-semibold">{s.value}</span></div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full ${s.color}`} style={{ width: `${Math.min(100, (s.value / s.max) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-border text-[10px] text-muted-foreground">
            Win rate: {funnel.calls ? Math.round((funnel.booked / funnel.calls) * 100) : 0}%
          </div>
        </div>

        {/* RIGHT: Leaderboard */}
        <div className="border border-border rounded-lg bg-background p-4">
          <div className="text-xs font-medium mb-3">Agent Leaderboard</div>
          {leaders.length === 0 ? (
            <div className="text-xs text-muted-foreground">No bookings yet.</div>
          ) : (
            <div className="space-y-2">
              {leaders.map(([name, count], i) => (
                <div key={name} className="flex items-center gap-2 text-xs">
                  <div className="w-5 text-center font-mono text-muted-foreground">{i + 1}</div>
                  <div className="flex-1 truncate">{name}</div>
                  <div className="font-semibold">{count}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
