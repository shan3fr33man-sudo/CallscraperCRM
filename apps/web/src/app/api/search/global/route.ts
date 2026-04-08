import { NextResponse } from "next/server";
import { crmClient, DEFAULT_ORG_ID } from "@/lib/crmdb";

export const runtime = "nodejs";

type Result = { type: string; id: string; label: string; sublabel: string; href: string };

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (!q) return NextResponse.json({ results: [] });

  const sb = crmClient();
  const like = `%${q}%`;
  const results: Result[] = [];

  const [customers, opportunities, jobs, tasks] = await Promise.all([
    sb.from("customers").select("id,customer_name,customer_phone").eq("org_id", DEFAULT_ORG_ID).or(`customer_name.ilike.${like},customer_phone.ilike.${like}`).limit(5),
    sb.from("opportunities").select("id,quote_number,customer_name,status").eq("org_id", DEFAULT_ORG_ID).or(`customer_name.ilike.${like},quote_number.ilike.${like}`).limit(5),
    sb.from("jobs").select("id,quote_number,customer_name,status").eq("org_id", DEFAULT_ORG_ID).or(`customer_name.ilike.${like},quote_number.ilike.${like}`).limit(5),
    sb.from("tasks").select("id,title,due_at").eq("org_id", DEFAULT_ORG_ID).ilike("title", like).limit(5),
  ]);

  for (const c of customers.data ?? []) {
    results.push({ type: "customer", id: c.id, label: c.customer_name ?? "(no name)", sublabel: c.customer_phone ?? "", href: `/customers/${c.id}` });
  }
  for (const o of opportunities.data ?? []) {
    results.push({ type: "opportunity", id: o.id, label: o.customer_name ?? o.quote_number ?? "(opportunity)", sublabel: o.status ?? "", href: `/sales/opportunity/${o.id}` });
  }
  for (const j of jobs.data ?? []) {
    results.push({ type: "job", id: j.id, label: j.customer_name ?? j.quote_number ?? "(job)", sublabel: j.status ?? "", href: `/dispatch/job/${j.id}` });
  }
  for (const t of tasks.data ?? []) {
    results.push({ type: "task", id: t.id, label: t.title, sublabel: t.due_at ?? "", href: `/tasks/${t.id}` });
  }

  return NextResponse.json({ results: results.slice(0, 20) });
}
