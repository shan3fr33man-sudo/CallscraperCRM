import { NextResponse } from "next/server";
import { crmClient, DEFAULT_ORG_ID } from "@/lib/crmdb";
import { callscraperClient } from "@/lib/callscraper";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * One-time backfill: merge call_summaries data (summary, transcript, sentiment,
 * lead_quality, move_type, move_date, price_quoted, key_details, action_items)
 * into activities (kind='call') payload by matching call_id → external_id.
 *
 * Also enriches customers with better names when current name is "Unknown Caller".
 */
export async function POST() {
  const up = callscraperClient();
  const sb = crmClient();
  const BATCH = 200;
  let cursor = "2020-01-01T00:00:00Z";
  let totalMerged = 0;
  let totalCustomersEnriched = 0;
  const errors: string[] = [];

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      // Fetch a batch of summaries from upstream
      const { data: summaries, error } = await up
        .from("call_summaries")
        .select("id, call_id, customer_name, customer_phone, summary, call_summary, call_outcome, move_type, move_date, price_quoted, lead_quality, sentiment, intent, transcript, key_details, action_items, created_at")
        .gt("created_at", cursor)
        .order("created_at", { ascending: true })
        .limit(BATCH);

      if (error) throw new Error(`upstream fetch: ${error.message}`);
      const rows = summaries ?? [];
      if (rows.length === 0) break;

      // For each summary, find the matching activity and update it individually
      // This avoids the problematic batch or() filter
      let batchMerged = 0;
      for (const r of rows) {
        if (!r.call_id) continue;

        // Find the matching activity by external_id
        const { data: acts } = await sb
          .from("activities")
          .select("id, record_id, payload")
          .eq("org_id", DEFAULT_ORG_ID)
          .eq("kind", "call")
          .eq("payload->>external_id", String(r.call_id))
          .limit(1);

        if (!acts || acts.length === 0) continue;
        const act = acts[0];
        const existingPayload = (act.payload as Record<string, unknown>) ?? {};

        // Skip if already enriched
        if (existingPayload.summary || existingPayload.transcript) continue;

        // Merge summary data into the activity payload
        const merged = {
          ...existingPayload,
          summary: r.summary ?? r.call_summary ?? null,
          transcript: r.transcript ?? null,
          sentiment: r.sentiment ?? null,
          intent: r.intent ?? null,
          move_type: r.move_type ?? null,
          move_date: r.move_date ?? null,
          price_quoted: r.price_quoted ?? null,
          lead_quality: r.lead_quality ?? null,
          key_details: r.key_details ?? null,
          action_items: r.action_items ?? null,
          call_outcome: r.call_outcome ?? existingPayload.call_outcome ?? null,
        };

        const { error: upErr } = await sb
          .from("activities")
          .update({ payload: merged })
          .eq("id", act.id);

        if (upErr) {
          errors.push(`update act ${act.id}: ${upErr.message}`);
        } else {
          batchMerged++;
        }

        // Enrich customer name if currently "Unknown Caller"
        if (r.customer_name && act.record_id) {
          const { data: cust } = await sb
            .from("customers")
            .select("id, customer_name")
            .eq("id", act.record_id)
            .maybeSingle();

          if (cust && (!cust.customer_name || cust.customer_name === "Unknown Caller" || cust.customer_name === "null")) {
            await sb
              .from("customers")
              .update({ customer_name: r.customer_name })
              .eq("id", cust.id);
            totalCustomersEnriched++;
          }
        }

        // Enrich opportunity fields if currently null
        if (act.record_id && (r.move_type || r.move_date || r.price_quoted)) {
          const { data: opp } = await sb
            .from("opportunities")
            .select("id, move_type, service_date, amount")
            .eq("customer_id", act.record_id)
            .eq("org_id", DEFAULT_ORG_ID)
            .limit(1)
            .maybeSingle();

          if (opp) {
            const updates: Record<string, unknown> = {};
            if (!opp.move_type && r.move_type) updates.move_type = r.move_type;
            if (!opp.service_date && r.move_date) updates.service_date = r.move_date;
            if ((!opp.amount || opp.amount === 0) && r.price_quoted) {
              const amt = Number(String(r.price_quoted).replace(/[^\d.]/g, "")) || 0;
              if (amt > 0) updates.amount = amt;
            }
            if (Object.keys(updates).length > 0) {
              await sb.from("opportunities").update(updates).eq("id", opp.id);
            }
          }
        }
      }

      totalMerged += batchMerged;
      cursor = rows[rows.length - 1].created_at as string;
      if (rows.length < BATCH) break;
    }

    return NextResponse.json({
      ok: true,
      activities_enriched: totalMerged,
      customers_enriched: totalCustomersEnriched,
      errors: errors.slice(0, 20),
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: (e as Error).message,
      activities_enriched: totalMerged,
      customers_enriched: totalCustomersEnriched,
      errors: errors.slice(0, 20),
    }, { status: 500 });
  }
}
