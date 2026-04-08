"use client";
import { useEffect, useState } from "react";
import { TopBar } from "@/components/TopBar";

type Row = {
  id: string;
  call_id: string;
  customer_name: string;
  duration_seconds: number;
  call_outcome: string | null;
  brand: string | null;
  transcript: string | null;
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  top_flag: string | null;
  coach_notes: string | null;
  strengths: string[];
  improvements: string[];
  flags: Array<{ category: string; message: string; impact: string; points: number }>;
  reviewed_at: string | null;
  created_at: string;
};
type Summary = { avg: number; count: number; top_grade: string; needs_attention: number; distribution: Record<string, number> };

const GRADE_COLORS: Record<string, string> = {
  A: "bg-green-500",
  B: "bg-blue-500",
  C: "bg-yellow-500",
  D: "bg-orange-500",
  F: "bg-red-500",
};

function fmtDur(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export default function CoachingPage() {
  const [days, setDays] = useState(7);
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [grade, setGrade] = useState<string>("");
  const [bucket, setBucket] = useState<string>("");
  const [brand, setBrand] = useState<string>("");
  const [selected, setSelected] = useState<Row | null>(null);
  const [notes, setNotes] = useState("");

  async function load() {
    const r = await fetch(`/api/coaching?days=${days}`);
    const j = await r.json();
    setRows(j.rows ?? []);
    setSummary(j.summary ?? null);
  }
  useEffect(() => { load(); }, [days]);

  const filtered = rows.filter((r) => {
    if (grade && r.grade !== grade) return false;
    if (bucket === "needs") return r.score < 65;
    if (bucket === "good") return r.score >= 65 && r.score < 85;
    if (bucket === "excellent") return r.score >= 85;
    if (brand && r.brand !== brand) return false;
    return true;
  });

  const brands = Array.from(new Set(rows.map((r) => r.brand).filter(Boolean))) as string[];

  async function saveNotes() {
    if (!selected) return;
    await fetch("/api/coaching", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: selected.id, coach_notes: notes }),
    });
    await load();
  }
  async function markReviewed() {
    if (!selected) return;
    await fetch("/api/coaching", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: selected.id, mark_reviewed: true }),
    });
    await load();
    setSelected(null);
  }

  const maxDist = summary ? Math.max(1, ...Object.values(summary.distribution)) : 1;

  return (
    <div>
      <TopBar title="Call Coaching" />
      <div className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="text-xs border border-border rounded px-2 py-1 bg-background">
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
          </select>
          {brands.length > 0 && (
            <select value={brand} onChange={(e) => setBrand(e.target.value)} className="text-xs border border-border rounded px-2 py-1 bg-background">
              <option value="">All brands</option>
              {brands.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          )}
        </div>

        {/* Summary tiles */}
        <div className="grid grid-cols-4 gap-3">
          <Tile label="Avg Score" value={summary?.avg ?? 0} />
          <Tile label="Calls Coached" value={summary?.count ?? 0} />
          <Tile label="Top Grade" value={summary?.top_grade ?? "—"} />
          <Tile label="Needs Attention" value={summary?.needs_attention ?? 0} accent={(summary?.needs_attention ?? 0) > 0 ? "text-red-600" : ""} />
        </div>

        {/* Grade distribution */}
        <div className="border border-border rounded-lg bg-background p-4">
          <div className="text-xs font-medium mb-3">Grade Distribution</div>
          <div className="flex items-end gap-3 h-28">
            {(["A", "B", "C", "D", "F"] as const).map((g) => {
              const n = summary?.distribution[g] ?? 0;
              const h = Math.round((n / maxDist) * 100);
              return (
                <div key={g} className="flex-1 flex flex-col items-center gap-1">
                  <div className="text-[10px] text-muted-foreground">{n}</div>
                  <div className={`w-full rounded-t ${GRADE_COLORS[g]}`} style={{ height: `${h}%`, minHeight: n > 0 ? 4 : 0 }} />
                  <div className="text-xs font-semibold">{g}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-1.5">
          {["", "A", "B", "C", "D", "F"].map((g) => (
            <button key={g || "any"} onClick={() => setGrade(g)} className={`text-[10px] px-2 py-1 rounded border ${grade === g ? "bg-accent text-white border-accent" : "border-border"}`}>
              {g || "Any grade"}
            </button>
          ))}
          <div className="w-px h-4 bg-border mx-1" />
          {[{ k: "", label: "All" }, { k: "needs", label: "Needs Work" }, { k: "good", label: "Good" }, { k: "excellent", label: "Excellent" }].map((b) => (
            <button key={b.k || "all"} onClick={() => setBucket(b.k)} className={`text-[10px] px-2 py-1 rounded border ${bucket === b.k ? "bg-accent text-white border-accent" : "border-border"}`}>
              {b.label}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="border border-border rounded-lg bg-background overflow-hidden">
          <div className="grid grid-cols-[1fr_1.5fr_0.8fr_1fr_0.8fr_1.5fr_1.5fr] text-[10px] uppercase text-muted-foreground px-3 py-2 border-b border-border">
            <div>Date</div><div>Caller</div><div>Duration</div><div>Outcome</div><div>Score</div><div>Top Flag</div><div>Notes</div>
          </div>
          {filtered.length === 0 && <div className="p-4 text-xs text-muted-foreground">No coached calls in range. Run the nightly cron or POST /api/agents/coach-calls to populate.</div>}
          {filtered.map((r) => (
            <div key={r.id} onClick={() => { setSelected(r); setNotes(r.coach_notes ?? ""); }} className="grid grid-cols-[1fr_1.5fr_0.8fr_1fr_0.8fr_1.5fr_1.5fr] text-xs px-3 py-2 border-b border-border hover:bg-muted/30 cursor-pointer">
              <div>{new Date(r.created_at).toLocaleDateString()}</div>
              <div className="truncate">{r.customer_name}</div>
              <div>{fmtDur(r.duration_seconds)}</div>
              <div className="truncate">{r.call_outcome ?? "—"}</div>
              <div className="flex items-center gap-1">
                <span>{r.score}</span>
                <span className={`text-[9px] text-white px-1 rounded ${GRADE_COLORS[r.grade]}`}>{r.grade}</span>
              </div>
              <div className="truncate">{r.top_flag ?? "—"}</div>
              <div className="truncate">{(r.coach_notes ?? "").slice(0, 50)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Coaching Drawer */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setSelected(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div onClick={(e) => e.stopPropagation()} className="relative w-[520px] h-full bg-panel border-l border-border flex flex-col overflow-y-auto">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">{selected.customer_name}</div>
                <div className="text-xs text-muted-foreground">Score: {selected.score} · Grade: {selected.grade}</div>
              </div>
              <button onClick={() => setSelected(null)} className="text-xs text-muted-foreground">Close</button>
            </div>
            <div className="p-4 space-y-4 text-xs">
              <div>
                <div className="font-medium mb-1">Strengths</div>
                <ul className="list-disc ml-4 space-y-0.5 text-green-700">
                  {selected.strengths.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
              <div>
                <div className="font-medium mb-1">Improvements</div>
                <ul className="list-disc ml-4 space-y-0.5 text-red-700">
                  {selected.improvements.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
              <div>
                <div className="font-medium mb-1">All Flags</div>
                <div className="space-y-1">
                  {selected.flags.map((f, i) => (
                    <div key={i} className="flex items-center justify-between border border-border rounded px-2 py-1">
                      <span>{f.message}</span>
                      <span className={f.points > 0 ? "text-green-600" : f.points < 0 ? "text-red-600" : "text-muted-foreground"}>{f.points > 0 ? `+${f.points}` : f.points}</span>
                    </div>
                  ))}
                </div>
              </div>
              {selected.transcript && (
                <div>
                  <div className="font-medium mb-1">Transcript (snippet)</div>
                  <div className="border border-border rounded p-2 bg-background whitespace-pre-wrap">{selected.transcript.slice(0, 500)}{selected.transcript.length > 500 ? "…" : ""}</div>
                </div>
              )}
              <div>
                <div className="font-medium mb-1">Coach Notes</div>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className="w-full border border-border rounded p-2 bg-background" />
                <div className="flex gap-2 mt-2">
                  <button onClick={saveNotes} className="text-xs px-3 py-1.5 rounded bg-accent text-white">Save Notes</button>
                  <button onClick={markReviewed} className="text-xs px-3 py-1.5 rounded border border-border">Mark Reviewed</button>
                </div>
                {selected.reviewed_at && <div className="text-[10px] text-muted-foreground mt-1">Reviewed {new Date(selected.reviewed_at).toLocaleString()}</div>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Tile({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="border border-border rounded-lg p-3 bg-background">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold ${accent ?? ""}`}>{value}</div>
    </div>
  );
}
