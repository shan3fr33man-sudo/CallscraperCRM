import { TopBar } from "@/components/TopBar";
import { crmClient, DEFAULT_ORG_ID } from "@/lib/crmdb";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface AgentRunRow {
  id: string;
  agent_name: string;
  subject_kind: string;
  subject_external_id: string | null;
  status: string;
  output: Record<string, unknown> | null;
  duration_ms: number | null;
  tokens_in: number | null;
  tokens_out: number | null;
  created_at: string;
}

export default async function AgentsPage() {
  const sb = crmClient();
  const { data: agents } = await sb.from("agents").select("*").eq("org_id", DEFAULT_ORG_ID);
  const { data: runs } = await sb
    .from("agent_runs")
    .select("*")
    .eq("org_id", DEFAULT_ORG_ID)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <>
      <TopBar title="Agents" />
      <div className="p-6 space-y-6 max-w-5xl">
        <div>
          <div className="text-xs uppercase text-muted mb-2">Configured agents</div>
          <div className="grid grid-cols-2 gap-3">
            {(agents ?? []).map((a) => (
              <div key={a.id} className="rounded-lg border border-border bg-panel p-4">
                <div className="text-sm font-medium">{a.name}</div>
                <div className="text-[11px] text-muted">{a.model}</div>
                <div className="text-xs text-muted mt-2 line-clamp-3">{a.system_prompt}</div>
              </div>
            ))}
            {(agents ?? []).length === 0 && (
              <div className="text-xs text-muted">No agents configured yet.</div>
            )}
          </div>
        </div>

        <div>
          <div className="text-xs uppercase text-muted mb-2">Recent runs</div>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-panel text-muted text-[11px] uppercase">
                <tr>
                  <th className="text-left px-3 py-2">When</th>
                  <th className="text-left px-3 py-2">Agent</th>
                  <th className="text-left px-3 py-2">Subject</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-left px-3 py-2">Result</th>
                  <th className="text-left px-3 py-2">Tokens</th>
                  <th className="text-left px-3 py-2">ms</th>
                </tr>
              </thead>
              <tbody>
                {((runs ?? []) as AgentRunRow[]).map((r) => {
                  const o = r.output ?? {};
                  const summary = (o.one_line_summary as string) ?? (o.next_best_action as string) ?? "";
                  return (
                    <tr key={r.id} className="border-t border-border hover:bg-white/5">
                      <td className="px-3 py-2 text-muted text-xs whitespace-nowrap">
                        {new Date(r.created_at).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-xs">{r.agent_name}</td>
                      <td className="px-3 py-2 text-xs">
                        {r.subject_external_id ? (
                          <Link className="hover:text-accent" href={`/calls/${r.subject_external_id}`}>
                            {r.subject_kind}: {r.subject_external_id.slice(0, 8)}…
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <span
                          className={
                            r.status === "ok"
                              ? "text-emerald-400"
                              : "text-red-400"
                          }
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted max-w-md truncate">{summary}</td>
                      <td className="px-3 py-2 text-xs text-muted">
                        {r.tokens_in ?? 0}/{r.tokens_out ?? 0}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted">{r.duration_ms ?? "—"}</td>
                    </tr>
                  );
                })}
                {(runs ?? []).length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-4 text-xs text-muted text-center">
                      No runs yet. Open a call and click &ldquo;Analyze with Claude&rdquo;.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
