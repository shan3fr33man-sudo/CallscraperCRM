import { TopBar } from "@/components/TopBar";
import { callscraperClient, type CallRow, type CallSummaryRow } from "@/lib/callscraper";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function loadCalls() {
  const sb = callscraperClient();
  const { data: calls, error } = await sb
    .from("calls")
    .select("*")
    .order("date", { ascending: false })
    .limit(100);
  if (error) throw error;

  const ids = (calls ?? []).map((c: CallRow) => c.id);
  const summaries = ids.length
    ? (await sb.from("call_summaries").select("*").in("call_id", ids)).data ?? []
    : [];
  const sumMap = new Map<string, CallSummaryRow>(
    summaries.map((s: CallSummaryRow) => [s.call_id as string, s]),
  );
  return { calls: (calls ?? []) as CallRow[], sumMap };
}

function fmtDuration(s: number | null | undefined) {
  if (!s) return "—";
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default async function CallsPage() {
  let data;
  try {
    data = await loadCalls();
  } catch (e) {
    return (
      <>
        <TopBar title="Calls" />
        <div className="p-6 text-sm text-red-400">{(e as Error).message}</div>
      </>
    );
  }
  const { calls, sumMap } = data;

  return (
    <>
      <TopBar title="Calls" />
      <div className="p-6">
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-panel text-muted text-[11px] uppercase">
              <tr>
                <th className="text-left px-3 py-2">When</th>
                <th className="text-left px-3 py-2">Caller</th>
                <th className="text-left px-3 py-2">Brand</th>
                <th className="text-left px-3 py-2">Dur</th>
                <th className="text-left px-3 py-2">Outcome</th>
                <th className="text-left px-3 py-2">Summary</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((c) => {
                const s = sumMap.get(c.id);
                return (
                  <tr key={c.id} className="border-t border-border hover:bg-white/5">
                    <td className="px-3 py-2 text-muted whitespace-nowrap">{fmtDate(c.started_at ?? c.date)}</td>
                    <td className="px-3 py-2">
                      <Link href={`/calls/${c.id}`} className="hover:text-accent">
                        {c.resolved_name ?? c.caller_name ?? c.from_number ?? "Unknown"}
                      </Link>
                      <div className="text-[11px] text-muted">{c.from_number}</div>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted">{c.brand ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-muted">{fmtDuration(c.duration_seconds ?? c.duration)}</td>
                    <td className="px-3 py-2 text-xs">
                      {s?.lead_quality && (
                        <span className="px-2 py-0.5 rounded bg-accent/15 text-accent text-[10px] uppercase">
                          {s.lead_quality}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted max-w-md truncate">
                      {s?.summary ?? s?.call_summary ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
