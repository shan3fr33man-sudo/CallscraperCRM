import { TopBar } from "@/components/TopBar";

export default function IntegrationsPage() {
  return (
    <>
      <TopBar title="Integrations" />
      <div className="p-6 max-w-3xl space-y-4">
        <div className="rounded-lg border border-border bg-panel p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Callscraper.com</div>
              <div className="text-xs text-muted">Direct Supabase mode · live</div>
            </div>
            <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 text-[11px] uppercase">
              Connected
            </span>
          </div>
          <p className="text-xs text-muted mt-3">
            Reads <code>calls</code>, <code>call_summaries</code>, and <code>leads</code> from your callscraper Supabase
            project using the service-role key. The mirror worker writes them into the CRM in the background.
          </p>
          <form action="/api/sync/callscraper" method="post" className="mt-4">
            <button
              type="submit"
              className="text-xs px-3 py-1.5 rounded bg-accent text-white"
            >
              Sync now
            </button>
          </form>
        </div>

        <div className="rounded-lg border border-dashed border-border p-5 text-xs text-muted">
          More integrations coming. Build your own with <code>@callscrapercrm/plugin-sdk</code>.
        </div>
      </div>
    </>
  );
}
