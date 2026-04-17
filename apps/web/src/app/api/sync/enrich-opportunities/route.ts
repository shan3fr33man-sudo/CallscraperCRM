import { NextResponse } from "next/server";
import { crmClient, DEFAULT_ORG_ID } from "@/lib/crmdb";

export const runtime = "nodejs";
export const maxDuration = 300;

const NULLISH = new Set(["", "null", "none", "not mentioned", "none mentioned", "none quoted", "unknown", "n/a", "not provided", "not specified"]);

function clean(val: unknown): string | null {
  if (val == null) return null;
  const s = String(val).trim();
  if (NULLISH.has(s.toLowerCase())) return null;
  return s;
}

function parsePrice(val: unknown): number | null {
  if (val == null) return null;
  const s = String(val).replace(/[^\d.]/g, "");
  const n = parseFloat(s);
  return isNaN(n) || n <= 0 ? null : n;
}

function parseAddress(val: unknown): Record<string, string> | null {
  const s = clean(val);
  if (!s) return null;
  // Simple: store as { raw: "the address string" } — structured parsing TBD
  return { raw: s };
}

/**
 * Enrich opportunities from key_details JSONB stored in activities.
 * key_details has camelCase fields: moveType, moveDate, priceQuoted,
 * originAddress, destinationAddress, tags, inventoryNotes, etc.
 */
export async function POST() {
  const sb = crmClient();
  let oppsUpdated = 0;
  let custsUpdated = 0;
  const errors: string[] = [];

  try {
    // Fetch activities that have key_details with actual data (paginated)
    const activities: { id: string; record_id: string | null; payload: Record<string, unknown> }[] = [];
    let offset = 0;
    const PAGE = 1000;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data: page, error: pgErr } = await sb
        .from("activities")
        .select("id, record_id, payload")
        .eq("org_id", DEFAULT_ORG_ID)
        .eq("kind", "call")
        .not("payload->key_details", "is", null)
        .order("created_at", { ascending: false })
        .range(offset, offset + PAGE - 1);
      if (pgErr) throw new Error(`fetch activities: ${pgErr.message}`);
      const rows = (page ?? []) as { id: string; record_id: string | null; payload: Record<string, unknown> }[];
      activities.push(...rows);
      if (rows.length < PAGE) break;
      offset += PAGE;
    }

    // Group by record_id (customer) to pick the best data across all their calls
    const custMap = new Map<string, {
      moveType: string | null;
      moveDate: string | null;
      price: number | null;
      origin: Record<string, string> | null;
      destination: Record<string, string> | null;
      tags: string[];
      customerName: string | null;
    }>();

    for (const act of activities ?? []) {
      const custId = act.record_id as string;
      if (!custId) continue;
      const payload = act.payload as Record<string, unknown>;
      const kd = payload?.key_details as Record<string, unknown> | null;
      if (!kd) continue;

      const existing = custMap.get(custId) ?? {
        moveType: null, moveDate: null, price: null,
        origin: null, destination: null, tags: [], customerName: null,
      };

      // Extract fields, preferring non-null values
      const mt = clean(kd.moveType);
      if (mt && !existing.moveType) existing.moveType = mt;

      const md = clean(kd.moveDate);
      if (md && !existing.moveDate) existing.moveDate = md;

      const pq = parsePrice(kd.priceQuoted);
      if (pq && !existing.price) existing.price = pq;

      const orig = parseAddress(kd.originAddress);
      if (orig && !existing.origin) existing.origin = orig;

      const dest = parseAddress(kd.destinationAddress);
      if (dest && !existing.destination) existing.destination = dest;

      // Collect unique tags
      if (Array.isArray(kd.tags)) {
        for (const t of kd.tags) {
          const tag = String(t).trim().toLowerCase();
          if (tag && !existing.tags.includes(tag)) existing.tags.push(tag);
        }
      }

      // Customer name from summary
      const cn = clean(payload.customer_name);
      if (cn && !existing.customerName) existing.customerName = cn;

      custMap.set(custId, existing);
    }

    // Now update opportunities and customers
    for (const [custId, data] of custMap) {
      // Update opportunity (first one for this customer)
      if (data.moveType || data.price || data.origin || data.destination) {
        const { data: opp } = await sb
          .from("opportunities")
          .select("id, move_type, amount, origin_json, destination_json, service_date")
          .eq("customer_id", custId)
          .eq("org_id", DEFAULT_ORG_ID)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (opp) {
          const updates: Record<string, unknown> = {};
          if (!opp.move_type && data.moveType) updates.move_type = data.moveType;
          if ((!opp.amount || opp.amount === 0) && data.price) updates.amount = data.price;
          if (!opp.origin_json && data.origin) updates.origin_json = data.origin;
          if (!opp.destination_json && data.destination) updates.destination_json = data.destination;
          if (!opp.service_date && data.moveDate) updates.service_date = data.moveDate;

          if (Object.keys(updates).length > 0) {
            const { error: upErr } = await sb
              .from("opportunities")
              .update(updates)
              .eq("id", opp.id);
            if (upErr) errors.push(`opp ${opp.id}: ${upErr.message}`);
            else oppsUpdated++;
          }
        }
      }

      // Update customer tags and name
      if (data.tags.length > 0 || data.customerName) {
        const { data: cust } = await sb
          .from("customers")
          .select("id, customer_name, tags")
          .eq("id", custId)
          .maybeSingle();

        if (cust) {
          const updates: Record<string, unknown> = {};
          // Merge tags
          const existingTags = Array.isArray(cust.tags) ? (cust.tags as string[]) : [];
          const newTags = data.tags.filter((t: string) => !existingTags.includes(t));
          if (newTags.length > 0) updates.tags = [...existingTags, ...newTags];
          // Better name
          if (data.customerName && (!cust.customer_name || cust.customer_name === "Unknown Caller" || cust.customer_name === "null")) {
            updates.customer_name = data.customerName;
          }

          if (Object.keys(updates).length > 0) {
            await sb.from("customers").update(updates).eq("id", cust.id);
            custsUpdated++;
          }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      activities_scanned: activities?.length ?? 0,
      unique_customers: custMap.size,
      opportunities_enriched: oppsUpdated,
      customers_enriched: custsUpdated,
      errors: errors.slice(0, 20),
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: (e as Error).message,
      opportunities_enriched: oppsUpdated,
      customers_enriched: custsUpdated,
    }, { status: 500 });
  }
}
