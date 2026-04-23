"use client";

import { useEffect, useState } from "react";
import { RefreshCw, TrendingUp, TrendingDown, Minus } from "lucide-react";

type Cursor = {
  id: string;
  move_category: string;
  target_count: number;
  fetched_count: number;
  status: "pending" | "running" | "done" | "failed";
  last_error: string | null;
  started_at: string | null;
  completed_at: string | null;
};

type Prediction = {
  id: string;
  confidence: number;
  margin_status: "ok" | "warn" | "block";
  pricing_mode: "local" | "long_distance";
  created_at: string;
};

type Status = {
  cursors: Cursor[];
  historical_by_category: Record<string, number>;
  totals: {
    move_size_stats: number;
    material_patterns: number;
    valuation_patterns: number;
    predictions: number;
  };
  recent_predictions: Prediction[];
};

export default function EstimatorSettingsPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function reload() {
    setLoading(true);
    const r = await fetch("/api/estimator-sync").then((r) => r.json());
    setStatus(r);
    setLoading(false);
  }
  useEffect(() => {
    reload();
  }, []);

  async function triggerRefresh() {
    setRefreshing(true);
    await fetch("/api/estimator-sync", { method: "POST" });
    setRefreshing(false);
    reload();
  }

  if (loading || !status) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Estimator Sync</h1>
        <p className="text-sm text-muted-foreground mt-1">
          SmartMoving historical scrape + aggregation status. The estimator reads from the aggregated tables below when predicting new estimates.
        </p>
        <div className="mt-3 flex gap-3 text-sm">
          <a
            href="/settings/estimator/branch-config"
            className="rounded border px-3 py-1.5 hover:bg-accent/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            Rate card & cost structure →
          </a>
          <a
            href="/settings/shops"
            className="rounded border px-3 py-1.5 hover:bg-accent/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            Dispatch yards →
          </a>
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium">Historical jobs per category</h2>
          <button
            className="flex items-center gap-1 rounded border px-3 py-1.5 text-sm disabled:opacity-50"
            onClick={triggerRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Re-run aggregation
          </button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="py-2">Category</th>
              <th className="py-2">Fetched</th>
              <th className="py-2">Target</th>
              <th className="py-2">Status</th>
              <th className="py-2">Completed</th>
            </tr>
          </thead>
          <tbody>
            {status.cursors.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-4 text-muted-foreground">
                  No sync cursors yet. Kick off the historical sync from the worker CLI.
                </td>
              </tr>
            ) : (
              status.cursors.map((c) => (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="py-2 font-medium">{c.move_category}</td>
                  <td className="py-2">{c.fetched_count.toLocaleString()}</td>
                  <td className="py-2">{c.target_count.toLocaleString()}</td>
                  <td className="py-2">
                    <StatusPill status={c.status} />
                    {c.last_error && <div className="text-xs text-red-600 mt-1">{c.last_error}</div>}
                  </td>
                  <td className="py-2 text-xs text-muted-foreground">
                    {c.completed_at ? new Date(c.completed_at).toLocaleString() : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="move_size_stats rows" value={status.totals.move_size_stats} />
        <Stat label="material_patterns rows" value={status.totals.material_patterns} />
        <Stat label="valuation_patterns rows" value={status.totals.valuation_patterns} />
        <Stat label="predictions logged" value={status.totals.predictions} />
      </div>

      <AccuracySection />

      <div className="rounded-lg border p-4">
        <h2 className="text-sm font-medium mb-3">Recent auto-estimates (last 20)</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="py-2">When</th>
              <th className="py-2">Mode</th>
              <th className="py-2">Confidence</th>
              <th className="py-2">Margin</th>
            </tr>
          </thead>
          <tbody>
            {status.recent_predictions.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-4 text-muted-foreground">
                  No auto-estimates yet.
                </td>
              </tr>
            ) : (
              status.recent_predictions.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="py-2 text-xs text-muted-foreground">
                    {new Date(p.created_at).toLocaleString()}
                  </td>
                  <td className="py-2">{p.pricing_mode}</td>
                  <td className="py-2">{(p.confidence * 100).toFixed(0)}%</td>
                  <td className="py-2">
                    <StatusPill status={p.margin_status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-2xl font-semibold">{value.toLocaleString()}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const color =
    status === "done" || status === "ok"
      ? "bg-green-100 text-green-800"
      : status === "running" || status === "warn"
        ? "bg-amber-100 text-amber-800"
        : status === "failed" || status === "block"
          ? "bg-red-100 text-red-800"
          : "bg-gray-100 text-gray-800";
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${color}`}>{status}</span>;
}

// ── Accuracy feedback section ───────────────────────────────────────────

type BucketStat = {
  brand_code: string;
  move_category: string;
  pricing_mode: "local" | "long_distance";
  n: number;
  mean_delta_pct: number;
  median_delta_pct: number;
  within_15_pct_rate: number;
  edited_pct: number;
};

type RecentFeedback = {
  id: string;
  brand_code: string;
  pricing_mode: "local" | "long_distance";
  predicted_amount: number | null;
  final_amount: number | null;
  amount_delta_pct: number | null;
  edited_by_agent: boolean | null;
  confidence: number | null;
  margin_status: string | null;
  final_captured_at: string | null;
  move_size: string | null;
};

type AccuracyPayload = {
  overall: {
    n: number;
    mean_delta_pct: number;
    median_delta_pct: number;
    within_15_pct_rate: number;
    edited_pct: number;
  };
  buckets: BucketStat[];
  recent: RecentFeedback[];
};

function AccuracySection() {
  const [data, setData] = useState<AccuracyPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/estimator-accuracy").then((r) => r.json());
        setData(r);
      } catch {
        /* silent */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return null;
  if (!data || data.overall.n === 0) {
    return (
      <div className="rounded-lg border p-4">
        <h2 className="text-sm font-medium mb-1">Estimator accuracy</h2>
        <p className="text-xs text-muted-foreground">
          No feedback captured yet. As agents send auto-generated estimates, the DB trigger records
          the predicted-vs-final delta and it shows up here. Needs at least one sent estimate to populate.
        </p>
      </div>
    );
  }

  const o = data.overall;
  const targetMet = o.within_15_pct_rate >= 0.8;

  return (
    <div className="rounded-lg border p-4 space-y-4">
      <div>
        <h2 className="text-sm font-medium">Estimator accuracy</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Predicted-vs-final drift for auto-generated estimates after the agent sends. Launch gate: ≥80% of
          predictions within ±15% of what actually got sent.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="feedback captured" value={o.n} />
        <DeltaStat label="mean delta" pct={o.mean_delta_pct} />
        <DeltaStat label="median delta" pct={o.median_delta_pct} />
        <PctStat
          label="within ±15%"
          pct={o.within_15_pct_rate * 100}
          good={targetMet}
        />
        <PctStat label="agent-edited" pct={o.edited_pct * 100} good={null} />
      </div>

      {data.buckets.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
            Drift by bucket
          </h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2">Brand</th>
                <th className="py-2">Category</th>
                <th className="py-2">Mode</th>
                <th className="py-2 text-right">n</th>
                <th className="py-2 text-right">Mean delta</th>
                <th className="py-2 text-right">Within ±15%</th>
                <th className="py-2 text-right">Edited</th>
              </tr>
            </thead>
            <tbody>
              {data.buckets.slice(0, 15).map((b, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-2 font-medium">{b.brand_code}</td>
                  <td className="py-2">{b.move_category}</td>
                  <td className="py-2">{b.pricing_mode}</td>
                  <td className="py-2 text-right">{b.n}</td>
                  <td className="py-2 text-right font-mono">
                    <DeltaInline pct={b.mean_delta_pct} />
                  </td>
                  <td className="py-2 text-right font-mono">
                    {(b.within_15_pct_rate * 100).toFixed(0)}%
                  </td>
                  <td className="py-2 text-right font-mono">
                    {(b.edited_pct * 100).toFixed(0)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data.recent.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
            Recent feedback (last 20 sent)
          </h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2">When sent</th>
                <th className="py-2">Brand</th>
                <th className="py-2">Mode</th>
                <th className="py-2 text-right">Predicted</th>
                <th className="py-2 text-right">Final</th>
                <th className="py-2 text-right">Delta</th>
                <th className="py-2">Edited?</th>
              </tr>
            </thead>
            <tbody>
              {data.recent.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="py-2 text-xs text-muted-foreground">
                    {r.final_captured_at ? new Date(r.final_captured_at).toLocaleString() : "—"}
                  </td>
                  <td className="py-2 font-medium">{r.brand_code}</td>
                  <td className="py-2">{r.pricing_mode}</td>
                  <td className="py-2 text-right font-mono">
                    {r.predicted_amount !== null ? `$${r.predicted_amount.toFixed(0)}` : "—"}
                  </td>
                  <td className="py-2 text-right font-mono">
                    {r.final_amount !== null ? `$${r.final_amount.toFixed(0)}` : "—"}
                  </td>
                  <td className="py-2 text-right font-mono">
                    <DeltaInline pct={r.amount_delta_pct ?? 0} />
                  </td>
                  <td className="py-2">
                    {r.edited_by_agent ? (
                      <span className="text-xs text-amber-700">edited</span>
                    ) : (
                      <span className="text-xs text-green-700">as-drafted</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DeltaStat({ label, pct }: { label: string; pct: number }) {
  const Icon = pct > 1 ? TrendingUp : pct < -1 ? TrendingDown : Minus;
  const color = pct > 1 ? "text-green-700" : pct < -1 ? "text-red-700" : "text-gray-600";
  return (
    <div className="rounded-lg border p-3">
      <div className={`text-2xl font-semibold flex items-center gap-1 ${color}`}>
        <Icon className="w-5 h-5" />
        {pct > 0 ? "+" : ""}{pct.toFixed(1)}%
      </div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function PctStat({ label, pct, good }: { label: string; pct: number; good: boolean | null }) {
  const color =
    good === null ? "" : good ? "text-green-700" : "text-amber-700";
  return (
    <div className="rounded-lg border p-3">
      <div className={`text-2xl font-semibold ${color}`}>{pct.toFixed(0)}%</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function DeltaInline({ pct }: { pct: number }) {
  const color = pct > 1 ? "text-green-700" : pct < -1 ? "text-red-700" : "text-gray-600";
  return (
    <span className={color}>
      {pct > 0 ? "+" : ""}{pct.toFixed(1)}%
    </span>
  );
}
