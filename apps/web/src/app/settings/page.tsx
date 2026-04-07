import { TopBar } from "@/components/TopBar";

export default function SettingsPage() {
  return (
    <>
      <TopBar title="Settings" />
      <div className="p-6 max-w-3xl text-sm text-muted">
        Settings coming soon — agents, API keys, custom objects.
      </div>
    </>
  );
}
