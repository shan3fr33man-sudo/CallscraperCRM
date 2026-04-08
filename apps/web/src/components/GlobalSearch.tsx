"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

type Result = { type: string; id: string; label: string; sublabel: string; href: string };

export function GlobalSearch() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const timer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!q.trim()) { setResults([]); return; }
    timer.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search/global?q=${encodeURIComponent(q)}`);
        const j = await r.json();
        setResults(j.results ?? []);
        setOpen(true);
      } catch {}
    }, 300);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [q]);

  return (
    <div className="relative w-96 max-w-full">
      <div className="flex items-center gap-2 border border-border rounded-md px-2 py-1 bg-background">
        <Search className="w-3.5 h-3.5 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          placeholder="Search customers, opportunities, jobs, tasks…"
          className="flex-1 bg-transparent text-xs outline-none"
        />
      </div>
      {open && results.length > 0 && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 top-9 z-50 bg-background border border-border rounded-md shadow-lg max-h-96 overflow-y-auto">
            {results.map((r) => (
              <button
                key={`${r.type}:${r.id}`}
                onClick={() => { setOpen(false); setQ(""); router.push(r.href); }}
                className="w-full text-left px-3 py-2 hover:bg-accent/10 border-b border-border last:border-0"
              >
                <div className="text-xs font-medium">{r.label}</div>
                <div className="text-[10px] text-muted-foreground">{r.type} · {r.sublabel}</div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
