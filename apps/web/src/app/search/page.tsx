"use client";
import { useState } from "react";
import { TopBar } from "@/components/TopBar";
import Link from "next/link";
import { Search } from "lucide-react";

interface CallHit {
  id: string;
  date: string;
  from_number: string | null;
  resolved_name: string | null;
  caller_name: string | null;
  brand: string | null;
}
interface LeadHit {
  id: string;
  created_at: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  brand: string | null;
}
interface SummaryHit {
  call_id: string | null;
  customer_name: string | null;
  summary: string | null;
  call_summary: string | null;
  move_type: string | null;
  price_quoted: string | null;
  lead_quality: string | null;
}

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ calls: CallHit[]; leads: LeadHit[]; summaries: SummaryHit[] } | null>(null);

  async function run() {
    if (!q.trim()) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const j = await r.json();
      setResults(j);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <TopBar title="Search" />
      <div className="p-6 max-w-4xl space-y-6">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && run()}
              placeholder="Search calls, transcripts, leads, customers…"
              className="w-full bg-panel border border-border rounded pl-9 pr-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
          <button onClick={run} disabled={loading} className="px-3 rounded bg-accent text-white text-sm disabled:opacity-50">
            {loading ? "…" : "Search"}
          </button>
        </div>

        {results && (
          <div className="space-y-6">
            <Section title={`Calls (${results.calls.length})`}>
              {results.calls.map((c) => (
                <Link
                  key={c.id}
                  href={`/calls/${c.id}`}
                  className="block rounded border border-border bg-panel p-3 hover:bg-white/5"
                >
                  <div className="text-sm">{c.resolved_name ?? c.caller_name ?? c.from_number ?? "Unknown"}</div>
                  <div className="text-[11px] text-muted">{new Date(c.date).toLocaleString()} · {c.brand}</div>
                </Link>
              ))}
            </Section>

            <Section title={`Transcript / summary matches (${results.summaries.length})`}>
              {results.summaries.map((s, i) => (
                <Link
                  key={i}
                  href={s.call_id ? `/calls/${s.call_id}` : "#"}
                  className="block rounded border border-border bg-panel p-3 hover:bg-white/5"
                >
                  <div className="text-sm">{s.customer_name ?? "—"}</div>
                  <div className="text-[11px] text-muted line-clamp-2">{s.summary ?? s.call_summary}</div>
                </Link>
              ))}
            </Section>

            <Section title={`Leads (${results.leads.length})`}>
              {results.leads.map((l) => (
                <div key={l.id} className="rounded border border-border bg-panel p-3">
                  <div className="text-sm">{l.customer_name}</div>
                  <div className="text-[11px] text-muted">
                    {l.customer_phone} · {l.customer_email} · {l.brand}
                  </div>
                </div>
              ))}
            </Section>
          </div>
        )}
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase text-muted mb-2">{title}</div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
