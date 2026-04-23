import { NextResponse } from "next/server";
import { crmClient } from "@/lib/crmdb";
import { requireOrgId } from "@/lib/auth";
import { calculateEstimate, previewRequestSchema } from "@callscrapercrm/pricing";
import type { FullTariff } from "@callscrapercrm/pricing";

export const runtime = "nodejs";

/** POST /api/tariffs/[id]/preview — run the pricing engine against this tariff. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let orgId: string;
  try { orgId = await requireOrgId(); }
  catch (res) { if (res instanceof Response) return res; throw res; }
  const { id } = await params;
  const sb = crmClient();

  // Validate input via zod
  const body = await req.json();
  const parsed = previewRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }
  const { input, options } = parsed.data;

  // Load full tariff
  const [tariffRes, ratesRes, modsRes, valsRes, capsRes, assignsRes] = await Promise.all([
    sb.from("tariffs").select("*").eq("id", id).eq("org_id", orgId).maybeSingle(),
    sb.from("tariff_rates").select("*").eq("tariff_id", id),
    sb.from("tariff_modifiers").select("*").eq("tariff_id", id).order("stacking_order"),
    sb.from("tariff_valuations").select("*").eq("tariff_id", id),
    sb.from("tariff_handicaps").select("*").eq("tariff_id", id),
    sb.from("tariff_assignments").select("*").eq("tariff_id", id),
  ]);
  if (!tariffRes.data) return NextResponse.json({ error: "Tariff not found" }, { status: 404 });

  const rateIds = (ratesRes.data ?? []).map((r) => r.id);
  let tiers: { id: string; tariff_rate_id: string; threshold: number; rate: number }[] = [];
  if (rateIds.length > 0) {
    const { data: tierRows } = await sb.from("tariff_tiers").select("*").in("tariff_rate_id", rateIds);
    tiers = tierRows ?? [];
  }
  const ratesWithTiers = (ratesRes.data ?? []).map((r) => ({
    ...r,
    tiers: tiers.filter((t) => t.tariff_rate_id === r.id),
  }));

  const fullTariff: FullTariff = {
    ...(tariffRes.data as Omit<FullTariff, "rates" | "modifiers" | "valuations" | "handicaps" | "assignments">),
    rates: ratesWithTiers as FullTariff["rates"],
    modifiers: (modsRes.data ?? []) as FullTariff["modifiers"],
    valuations: (valsRes.data ?? []) as FullTariff["valuations"],
    handicaps: (capsRes.data ?? []) as FullTariff["handicaps"],
    assignments: (assignsRes.data ?? []) as FullTariff["assignments"],
  };

  try {
    const result = calculateEstimate(fullTariff, input, options ?? {});
    return NextResponse.json({ result });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
