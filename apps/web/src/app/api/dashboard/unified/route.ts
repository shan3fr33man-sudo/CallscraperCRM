import { NextResponse } from "next/server";
import { callscraperClient } from "@/lib/callscraper";
import { crmClient } from "@/lib/crmdb";
import { requireOrgId } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MetricResult = { value: number; error: string | null };

async function safe(label: string, fn: () => Promise<number>): Promise<MetricResult> {
  try {
    return { value: await fn(), error: null };
  } catch (e) {
    return { value: 0, error: `${label}: ${(e as Error).message}` };
  }
}

export async function GET() {
  let orgId: string;
  try { orgId = await requireOrgId(); } catch (res) { if (res instanceof Response) return res; throw res; }
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    callsRes,
    leadsRes,
    newOppsRes,
    bookedRes,
    arRes,
    overdueRes,
  ] = await Promise.all([
    safe("calls", async () => {
      const sb = callscraperClient();
      const { count, error } = await sb
        .from("calls")
        .select("*", { count: "exact", head: true })
        .gte("date", since);
      if (error) throw new Error(error.message);
      return count ?? 0;
    }),
    safe("leads", async () => {
      const sb = callscraperClient();
      const { count, error } = await sb
        .from("leads")
        .select("*", { count: "exact", head: true })
        .gte("created_at", since);
      if (error) throw new Error(error.message);
      return count ?? 0;
    }),
    safe("newOpps", async () => {
      const sb = crmClient();
      const { count, error } = await sb
        .from("opportunities")
        .select("*", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("status", "new")
        .gte("created_at", since);
      if (error) throw new Error(error.message);
      return count ?? 0;
    }),
    safe("booked", async () => {
      const sb = crmClient();
      const { count, error } = await sb
        .from("opportunities")
        .select("*", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("status", "booked")
        .gte("updated_at", since);
      if (error) throw new Error(error.message);
      return count ?? 0;
    }),
    safe("outstandingAR", async () => {
      const sb = crmClient();
      const { data, error } = await sb
        .from("invoices")
        .select("balance")
        .eq("org_id", orgId)
        .in("status", ["sent", "partial", "overdue"]);
      if (error) throw new Error(error.message);
      return (data ?? []).reduce((sum, row) => sum + (Number((row as { balance: number | null }).balance) || 0), 0);
    }),
    safe("overdueCount", async () => {
      const sb = crmClient();
      const { count, error } = await sb
        .from("invoices")
        .select("*", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("status", "overdue");
      if (error) throw new Error(error.message);
      return count ?? 0;
    }),
  ]);

  const errors = [
    callsRes.error,
    leadsRes.error,
    newOppsRes.error,
    bookedRes.error,
    arRes.error,
    overdueRes.error,
  ].filter((e): e is string => !!e);

  return NextResponse.json({
    metrics: {
      callsThisWeek: callsRes.value,
      leadsThisWeek: leadsRes.value,
      newOppsThisWeek: newOppsRes.value,
      bookedThisWeek: bookedRes.value,
      outstandingAR: arRes.value,
      overdueCount: overdueRes.value,
    },
    errors,
  });
}
