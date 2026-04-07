import { TopBar } from "@/components/TopBar";
import { callscraperClient, type LeadRow } from "@/lib/callscraper";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const sb = callscraperClient();
  const { data, error } = await sb
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return (
      <>
        <TopBar title="Leads" />
        <div className="p-6 text-sm text-red-400">{error.message}</div>
      </>
    );
  }

  const leads = (data ?? []) as LeadRow[];

  return (
    <>
      <TopBar title="Leads" />
      <div className="p-6">
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-panel text-muted text-[11px] uppercase">
              <tr>
                <th className="text-left px-3 py-2">When</th>
                <th className="text-left px-3 py-2">Customer</th>
                <th className="text-left px-3 py-2">Phone</th>
                <th className="text-left px-3 py-2">Email</th>
                <th className="text-left px-3 py-2">Brand</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id} className="border-t border-border hover:bg-white/5">
                  <td className="px-3 py-2 text-muted text-xs whitespace-nowrap">
                    {new Date(l.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2">{l.customer_name ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted">{l.customer_phone ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted">{l.customer_email ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted">{l.brand ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
