"use client";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ErrorBanner } from "@/components/ui";

export type Row = Record<string, unknown>;
export type ColumnDef = { key: string; label: string; render?: (row: Row) => ReactNode; width?: string };
export type FilterDef =
  | { key: string; label: string; type: "select"; options: { value: string; label: string }[] }
  | { key: string; label: string; type: "chip"; options: { value: string; label: string }[] }
  | { key: string; label: string; type: "search" };

export function EntityTable({
  query,
  columns,
  filters = [],
  onRowClick,
  emptyMessage = "No records found",
  empty,
  title,
  actions,
}: {
  query: () => Promise<Row[]>;
  columns: ColumnDef[];
  filters?: FilterDef[];
  onRowClick?: (row: Row) => void;
  /** Fallback text when the list is empty AND no `empty` slot is provided. */
  emptyMessage?: string;
  /** Preferred: pass a full <EmptyState /> (or any node) to render when the
   *  unfiltered list is empty. Shows instead of `emptyMessage`. */
  empty?: ReactNode;
  title?: string;
  actions?: ReactNode;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterState, setFilterState] = useState<Record<string, string>>({});
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [limit, setLimit] = useState(100);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    query()
      .then((data) => {
        if (!cancelled) {
          setRows(data);
          setLoading(false);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          // Surface the error instead of silently clearing rows — design
          // audit finding #4 was that swallowed catches leave users with a
          // blank table and no indication of what went wrong.
          setError(e instanceof Error ? e.message : "Failed to load");
          setRows([]);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTick]);

  const filtered = useMemo(() => {
    let r = rows;
    for (const [k, v] of Object.entries(filterState)) {
      if (!v) continue;
      r = r.filter((row) => String(row[k] ?? "").toLowerCase().includes(v.toLowerCase()));
    }
    if (sortKey) {
      r = [...r].sort((a, b) => {
        const av = String(a[sortKey] ?? ""); const bv = String(b[sortKey] ?? "");
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }
    return r;
  }, [rows, filterState, sortKey, sortDir]);

  const visible = filtered.slice(0, limit);

  function toggleSort(k: string) {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("asc"); }
  }

  const hasActiveFilter = Object.values(filterState).some((v) => Boolean(v));

  return (
    <div>
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        {title && <div className="text-sm font-semibold mr-2">{title}</div>}
        {filters.map((f) => {
          if (f.type === "search") {
            return <input key={f.key} placeholder={f.label} value={filterState[f.key] ?? ""} onChange={(e) => setFilterState({ ...filterState, [f.key]: e.target.value })} className="text-xs border border-border rounded-md px-2 py-1.5 bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60" />;
          }
          if (f.type === "select") {
            return (
              <select key={f.key} value={filterState[f.key] ?? ""} onChange={(e) => setFilterState({ ...filterState, [f.key]: e.target.value })} className="text-xs border border-border rounded-md px-2 py-1.5 bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60">
                <option value="">{f.label}</option>
                {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            );
          }
          return (
            <div key={f.key} className="flex gap-1 flex-wrap">
              <button onClick={() => setFilterState({ ...filterState, [f.key]: "" })} className={`text-xs px-2 py-1 rounded-md border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${!filterState[f.key] ? "bg-accent text-white border-accent" : "border-border"}`}>All</button>
              {f.options.map((o) => (
                <button key={o.value} onClick={() => setFilterState({ ...filterState, [f.key]: o.value })} className={`text-xs px-2 py-1 rounded-md border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${filterState[f.key] === o.value ? "bg-accent text-white border-accent" : "border-border"}`}>{o.label}</button>
              ))}
            </div>
          );
        })}
        <button onClick={() => setRefreshTick((t) => t + 1)} className="text-xs px-2 py-1 rounded-md border border-border ml-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60">Refresh</button>
        {actions}
      </div>
      {error ? (
        <div className="mb-3">
          <ErrorBanner message={error} onRetry={() => setRefreshTick((t) => t + 1)} />
        </div>
      ) : null}
      <div className="border border-border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-accent/5 text-xs">
            <tr>
              {columns.map((c) => (
                <th key={c.key} onClick={() => toggleSort(c.key)} className="text-left px-3 py-2 cursor-pointer select-none" style={c.width ? { width: c.width } : undefined}>
                  {c.label} {sortKey === c.key && (sortDir === "asc" ? "↑" : "↓")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-t border-border">{columns.map((c) => <td key={c.key} className="px-3 py-2"><div className="h-3 bg-accent/10 rounded animate-pulse" /></td>)}</tr>
            ))}
            {!loading && !error && visible.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-6">
                  {empty && !hasActiveFilter ? (
                    empty
                  ) : (
                    <div className="text-center text-xs text-muted-foreground">
                      {hasActiveFilter ? "No records match the current filters." : emptyMessage}
                    </div>
                  )}
                </td>
              </tr>
            )}
            {!loading && visible.map((row, i) => (
              <tr key={(row.id as string) ?? i} onClick={() => onRowClick?.(row)} className={`border-t border-border ${onRowClick ? "cursor-pointer hover:bg-accent/5" : ""}`}>
                {columns.map((c) => <td key={c.key} className="px-3 py-2">{c.render ? c.render(row) : String(row[c.key] ?? "—")}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length > limit && (
        <div className="flex justify-center mt-3">
          <button onClick={() => setLimit(limit + 100)} className="text-xs px-3 py-1.5 rounded-md border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60">Load more ({filtered.length - limit} remaining)</button>
        </div>
      )}
    </div>
  );
}
