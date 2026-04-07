import { TopBar } from "@/components/TopBar";
import { callscraperClient } from "@/lib/callscraper";

export const dynamic = "force-dynamic";

async function loadStats() {
  try {
    const sb = callscraperClient();
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [{ count: callCount }, { count: leadCount }, { count: summaryCount }] = await Promise.all([
      sb.from("calls").select("*", { count: "exact", head: true }).gte("date", since),
      sb.from("leads").select("*", { count: "exact", head: true }).gte("created_at", since),
      sb.from("call_summaries").select("*", { count: "exact", head: true }).gte("created_at", since),
    ]);
    return { callCount: callCount ?? 0, leadCount: leadCount ?? 0, summaryCount: summaryCount ?? 0, error: null };
  } catch (e) {
    return { callCount: 0, leadCount: 0, summaryCount: 0, error: (e as Error).message };
  }
}

export default async function Home() {
  const stats = await loadStats();
  return (
    <>
      <TopBar title="Dashboard" />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-3 gap-4 max-w-3xl">
          <Stat label="Calls (7d)" value={stats.callCount} />
          <Stat label="Leads (7d)" value={stats.leadCount} />
          <Stat label="AI Summaries (7d)" value={stats.summaryCount} />
        </div>
        {stats.error && (
          <div className="text-xs text-red-400 max-w-3xl">
            Couldn&apos;t reach upstream callscraper Supabase: {stats.error}
          </div>
        )}
        <div className="text-xs text-muted max-w-3xl">
          Live data is read directly from your callscraper.com Supabase project. The CRM mirror runs in the
          background via the worker — see <code>/integrations</code>.
        </div>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-panel p-4">
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value.toLocaleString()}</div>
    </div>
  );
}
