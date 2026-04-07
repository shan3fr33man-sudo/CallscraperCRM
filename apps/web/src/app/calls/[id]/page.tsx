import { TopBar } from "@/components/TopBar";
import { callscraperClient, type CallRow, type CallSummaryRow } from "@/lib/callscraper";
import { CallActions } from "@/components/CallActions";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CallDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = callscraperClient();
  const { data: call } = await sb.from("calls").select("*").eq("id", id).maybeSingle();
  if (!call) notFound();
  const { data: summary } = await sb
    .from("call_summaries")
    .select("*")
    .eq("call_id", id)
    .maybeSingle();
  const c = call as CallRow;
  const s = summary as CallSummaryRow | null;

  return (
    <>
      <TopBar title="Call detail" />
      <div className="p-6 grid grid-cols-3 gap-6 max-w-6xl">
        <div className="col-span-2 space-y-4">
          <Section title="Summary">
            <div className="text-sm whitespace-pre-wrap">{s?.summary ?? s?.call_summary ?? "No summary."}</div>
          </Section>
          <Section title="Transcript">
            <div className="text-xs whitespace-pre-wrap text-muted max-h-96 overflow-y-auto">
              {s?.transcript ?? "No transcript."}
            </div>
          </Section>
        </div>
        <div className="space-y-4">
          <Section title="Caller">
            <Field label="Name" value={c.resolved_name ?? c.caller_name} />
            <Field label="From" value={c.from_number} />
            <Field label="To" value={c.to_number} />
            <Field label="Brand" value={c.brand} />
            <Field label="Direction" value={c.direction} />
            <Field label="Agent ext" value={c.agent_ext} />
          </Section>
          <Section title="Upstream AI (Gemini)">
            <Field label="Sentiment" value={s?.sentiment} />
            <Field label="Intent" value={s?.intent} />
            <Field label="Lead quality" value={s?.lead_quality} />
            <Field label="Move type" value={s?.move_type} />
            <Field label="Move date" value={s?.move_date} />
            <Field label="Quoted" value={s?.price_quoted} />
          </Section>
          <CallActions callId={id} />
        </div>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-panel">
      <div className="px-4 py-2 border-b border-border text-[11px] uppercase tracking-wide text-muted">{title}</div>
      <div className="p-4 space-y-2">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="flex justify-between gap-3 text-xs">
      <div className="text-muted">{label}</div>
      <div className="text-text text-right">{(value as string) ?? "—"}</div>
    </div>
  );
}
