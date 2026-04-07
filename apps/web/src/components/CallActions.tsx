"use client";
import { useEffect, useState } from "react";
import { Sparkles, Send } from "lucide-react";

interface Activity {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  created_at: string;
}

interface Analysis {
  lead_quality?: string;
  stage?: string;
  score?: number;
  one_line_summary?: string;
  next_best_action?: string;
  followup_text?: string;
  reasoning?: string;
}

export function CallActions({ callId }: { callId: string }) {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [note, setNote] = useState("");
  const [posting, setPosting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function loadActivities() {
    const r = await fetch(`/api/notes?call_id=${callId}`);
    const j = (await r.json()) as { activities: Activity[] };
    setActivities(j.activities ?? []);
  }
  useEffect(() => {
    loadActivities();
  }, [callId]);

  async function analyze() {
    setAnalyzing(true);
    setErr(null);
    try {
      const r = await fetch("/api/agents/analyze-call", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ call_id: callId }),
      });
      const j = (await r.json()) as { result?: Analysis; error?: string };
      if (j.error) setErr(j.error);
      else setAnalysis(j.result ?? null);
      await loadActivities();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setAnalyzing(false);
    }
  }

  async function postNote() {
    if (!note.trim()) return;
    setPosting(true);
    try {
      await fetch("/api/notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ call_id: callId, text: note }),
      });
      setNote("");
      await loadActivities();
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-panel">
        <div className="px-4 py-2 border-b border-border text-[11px] uppercase tracking-wide text-muted flex items-center justify-between">
          <span>AI Analysis</span>
          <button
            onClick={analyze}
            disabled={analyzing}
            className="text-[11px] flex items-center gap-1 px-2 py-1 rounded bg-accent/15 text-accent hover:bg-accent/25 disabled:opacity-50"
          >
            <Sparkles className="w-3 h-3" /> {analyzing ? "Analyzing…" : "Analyze with Claude"}
          </button>
        </div>
        <div className="p-4 text-xs space-y-2">
          {err && <div className="text-red-400">{err}</div>}
          {!analysis && !err && (
            <div className="text-muted">Click Analyze to score this lead and draft a follow-up.</div>
          )}
          {analysis && (
            <div className="space-y-2">
              <div className="flex gap-2 flex-wrap">
                {analysis.lead_quality && (
                  <Badge>{analysis.lead_quality}</Badge>
                )}
                {analysis.stage && <Badge>{analysis.stage}</Badge>}
                {typeof analysis.score === "number" && <Badge>{analysis.score}/100</Badge>}
              </div>
              {analysis.one_line_summary && (
                <div className="text-text">{analysis.one_line_summary}</div>
              )}
              {analysis.next_best_action && (
                <div>
                  <div className="text-muted text-[10px] uppercase">Next best action</div>
                  <div className="text-text">{analysis.next_best_action}</div>
                </div>
              )}
              {analysis.followup_text && (
                <div>
                  <div className="text-muted text-[10px] uppercase">Drafted follow-up</div>
                  <div className="text-text whitespace-pre-wrap bg-bg/50 border border-border rounded p-2 mt-1">
                    {analysis.followup_text}
                  </div>
                </div>
              )}
              {analysis.reasoning && (
                <div className="text-muted">{analysis.reasoning}</div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-panel">
        <div className="px-4 py-2 border-b border-border text-[11px] uppercase tracking-wide text-muted">
          Activity
        </div>
        <div className="p-4 space-y-3 text-xs">
          <div className="flex gap-2">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && postNote()}
              placeholder="Add a note…"
              className="flex-1 bg-bg border border-border rounded px-2 py-1.5 outline-none focus:border-accent"
            />
            <button
              onClick={postNote}
              disabled={posting || !note.trim()}
              className="px-2 rounded bg-accent text-white disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
          {activities.length === 0 && <div className="text-muted">No activity yet.</div>}
          {activities.map((a) => (
            <div key={a.id} className="border-l-2 border-border pl-3">
              <div className="text-muted text-[10px] uppercase">
                {a.kind} · {new Date(a.created_at).toLocaleString()}
              </div>
              <div className="text-text whitespace-pre-wrap mt-0.5">
                {a.kind === "note"
                  ? (a.payload.text as string)
                  : JSON.stringify(a.payload, null, 2)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-2 py-0.5 rounded bg-accent/15 text-accent text-[10px] uppercase">{children}</span>
  );
}
