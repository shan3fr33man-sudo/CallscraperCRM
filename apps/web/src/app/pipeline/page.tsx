import { TopBar } from "@/components/TopBar";
import { callscraperClient, type CallRow, type CallSummaryRow } from "@/lib/callscraper";

export const dynamic = "force-dynamic";

const STAGES = [
  { key: "new",       label: "New",        match: (s: CallSummaryRow | undefined) => !s || (!s.lead_quality && !s.call_outcome) },
  { key: "qualified", label: "Qualified",  match: (s: CallSummaryRow | undefined) => s?.lead_quality?.toLowerCase().includes("qual") ?? false },
  { key: "quoted",    label: "Quoted",     match: (s: CallSummaryRow | undefined) => !!s?.price_quoted },
  { key: "won",       label: "Won",        match: (s: CallSummaryRow | undefined) => s?.call_outcome?.toLowerCase().includes("book") ?? false },
  { key: "lost",      label: "Lost",       match: (s: CallSummaryRow | undefined) => s?.call_outcome?.toLowerCase().includes("lost") ?? false },
];

export default async function PipelinePage() {
  const sb = callscraperClient();
  const { data: calls } = await sb
    .from("calls")
    .select("*")
    .order("date", { ascending: false })
    .limit(150);
  const ids = (calls ?? []).map((c: CallRow) => c.id);
  const { data: summaries } = ids.length
    ? await sb.from("call_summaries").select("*").in("call_id", ids)
    : { data: [] as CallSummaryRow[] };
  const sumMap = new Map<string, CallSummaryRow>(
    (summaries ?? []).map((s: CallSummaryRow) => [s.call_id as string, s]),
  );

  const cards = (calls ?? []).map((c: CallRow) => ({ call: c, summary: sumMap.get(c.id) }));

  return (
    <>
      <TopBar title="Pipeline" />
      <div className="p-6 overflow-x-auto">
        <div className="flex gap-4 min-w-max">
          {STAGES.map((stage) => {
            const items = cards.filter((x) => stage.match(x.summary));
            return (
              <div key={stage.key} className="w-72 shrink-0">
                <div className="flex items-center justify-between mb-2 px-1">
                  <div className="text-sm font-medium">{stage.label}</div>
                  <div className="text-[11px] text-muted">{items.length}</div>
                </div>
                <div className="space-y-2">
                  {items.slice(0, 30).map((x) => (
                    <div key={x.call.id} className="rounded-md border border-border bg-panel p-3 text-xs">
                      <div className="text-text font-medium truncate">
                        {x.summary?.customer_name ?? x.call.resolved_name ?? x.call.caller_name ?? x.call.from_number}
                      </div>
                      <div className="text-muted text-[11px] truncate">
                        {x.summary?.move_type ?? x.call.brand ?? "—"}
                        {x.summary?.price_quoted && ` · $${x.summary.price_quoted}`}
                      </div>
                      <div className="text-muted text-[10px] mt-1 line-clamp-2">
                        {x.summary?.summary ?? x.summary?.call_summary ?? ""}
                      </div>
                    </div>
                  ))}
                  {items.length === 0 && <div className="text-[11px] text-muted px-1">empty</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
