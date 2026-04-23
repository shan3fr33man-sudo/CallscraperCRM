import { TopBar } from "@/components/TopBar";
import { UnifiedDashboardTiles } from "@/components/UnifiedDashboardTiles";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <>
      <TopBar title="Dashboard" />
      <div className="p-6 space-y-6">
        <UnifiedDashboardTiles />
        <div className="text-xs text-muted max-w-3xl">
          Live data is read directly from your callscraper.com Supabase project. The CRM mirror runs in the
          background via the worker — see <code>/integrations</code>.
        </div>
      </div>
    </>
  );
}
