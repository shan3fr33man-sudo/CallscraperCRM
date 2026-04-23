"use client";

import { useEffect, useState } from "react";

type Metrics = {
  callsThisWeek: number;
  leadsThisWeek: number;
  newOppsThisWeek: number;
  bookedThisWeek: number;
  outstandingAR: number;
  overdueCount: number;
};

type ApiResponse = {
  metrics: Metrics;
  errors: string[];
};

const ZERO_METRICS: Metrics = {
  callsThisWeek: 0,
  leadsThisWeek: 0,
  newOppsThisWeek: 0,
  bookedThisWeek: 0,
  outstandingAR: 0,
  overdueCount: 0,
};

const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function UnifiedDashboardTiles() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/dashboard/unified", { cache: "no-store" });
        const j = (await res.json()) as Partial<ApiResponse> & { error?: string };
        if (cancelled) return;
        // API may return {error: "..."} on 401/403 or partial shape on internal
        // errors — coerce to the tile-safe shape so the component never crashes.
        if (!res.ok || !j.metrics) {
          setData({
            metrics: ZERO_METRICS,
            errors: [j.error ?? `HTTP ${res.status}`],
          });
          return;
        }
        setData({
          metrics: { ...ZERO_METRICS, ...j.metrics },
          errors: j.errors ?? [],
        });
      } catch (e) {
        if (!cancelled) {
          setData({
            metrics: ZERO_METRICS,
            errors: [`fetch: ${(e as Error).message}`],
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || !data) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-5xl">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-border bg-panel p-4 animate-pulse"
          >
            <div className="h-3 w-20 bg-border rounded" />
            <div className="h-7 w-16 bg-border rounded mt-2" />
          </div>
        ))}
      </div>
    );
  }

  const m = data.metrics;
  const overdueTint = m.overdueCount > 0 ? "text-red-400" : undefined;

  return (
    <div className="space-y-3 max-w-5xl">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Tile label="Calls (7d)" value={m.callsThisWeek.toLocaleString()} valueClass="text-accent" />
        <Tile label="Leads (7d)" value={m.leadsThisWeek.toLocaleString()} valueClass="text-accent" />
        <Tile label="New Opps (7d)" value={m.newOppsThisWeek.toLocaleString()} />
        <Tile
          label="Booked (7d)"
          value={m.bookedThisWeek.toLocaleString()}
          valueClass="text-green-400"
        />
        <Tile label="Outstanding AR" value={USD.format(m.outstandingAR)} />
        <Tile
          label="Overdue invoices"
          value={m.overdueCount.toLocaleString()}
          valueClass={overdueTint}
        />
      </div>
      {data.errors.length > 0 && (
        <div className="text-xs text-red-400/80">
          Some metrics unavailable: {data.errors.join("; ")}
        </div>
      )}
    </div>
  );
}

function Tile({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-panel p-4">
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${valueClass ?? ""}`}>{value}</div>
    </div>
  );
}
