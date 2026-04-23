import { NextResponse } from "next/server";
import { crmClient } from "@/lib/crmdb";
import { requireOrgId } from "@/lib/auth";

export const runtime = "nodejs";

type InventoryRow = {
  id?: string;
  room_name: string;
  item_name: string;
  quantity: number;
  weight_lbs?: number | null;
  cubic_feet?: number | null;
  is_heavy?: boolean;
  notes?: string | null;
};

/** GET /api/opportunities/[id]/inventory — list items grouped by room. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  let orgId: string;
  try { orgId = await requireOrgId(); }
  catch (res) { if (res instanceof Response) return res; throw res; }
  const { id } = await params;
  const sb = crmClient();
  const { data, error } = await sb
    .from("inventory_items")
    .select("*")
    .eq("opportunity_id", id)
    .eq("org_id", orgId)
    .order("room_name")
    .order("item_name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Group by room
  const grouped: Record<string, InventoryRow[]> = {};
  for (const item of data ?? []) {
    const r = item.room_name as string;
    if (!grouped[r]) grouped[r] = [];
    grouped[r].push(item as InventoryRow);
  }

  // Compute totals
  const total_items = (data ?? []).reduce((s, r) => s + ((r.quantity as number) ?? 0), 0);
  const total_weight = (data ?? []).reduce(
    (s, r) => s + ((r.weight_lbs as number) ?? 0) * ((r.quantity as number) ?? 0),
    0,
  );
  const total_cuft = (data ?? []).reduce(
    (s, r) => s + ((r.cubic_feet as number) ?? 0) * ((r.quantity as number) ?? 0),
    0,
  );

  return NextResponse.json({
    items: data ?? [],
    rooms: grouped,
    totals: { total_items, total_weight, total_cuft },
  });
}

/** POST /api/opportunities/[id]/inventory — add a single item. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let orgId: string;
  try { orgId = await requireOrgId(); }
  catch (res) { if (res instanceof Response) return res; throw res; }
  const { id } = await params;
  const body = (await req.json()) as InventoryRow;
  const sb = crmClient();
  const { data, error } = await sb
    .from("inventory_items")
    .insert({
      org_id: orgId,
      opportunity_id: id,
      room_name: body.room_name ?? "Other",
      item_name: body.item_name ?? "Item",
      quantity: body.quantity ?? 1,
      weight_lbs: body.weight_lbs ?? null,
      cubic_feet: body.cubic_feet ?? null,
      is_heavy: body.is_heavy ?? false,
      notes: body.notes ?? null,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}

/** PUT /api/opportunities/[id]/inventory — bulk replace. Body: { items: InventoryRow[] }. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let orgId: string;
  try { orgId = await requireOrgId(); }
  catch (res) { if (res instanceof Response) return res; throw res; }
  const { id } = await params;
  const body = (await req.json()) as { items: InventoryRow[] };
  const sb = crmClient();

  // Wipe existing for this opportunity
  await sb.from("inventory_items").delete().eq("opportunity_id", id).eq("org_id", orgId);

  if (!body.items || body.items.length === 0) {
    return NextResponse.json({ items: [] });
  }

  const rows = body.items.map((it) => ({
    org_id: orgId,
    opportunity_id: id,
    room_name: it.room_name ?? "Other",
    item_name: it.item_name ?? "Item",
    quantity: it.quantity ?? 1,
    weight_lbs: it.weight_lbs ?? null,
    cubic_feet: it.cubic_feet ?? null,
    is_heavy: it.is_heavy ?? false,
    notes: it.notes ?? null,
  }));
  const { data, error } = await sb.from("inventory_items").insert(rows).select("*");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}
