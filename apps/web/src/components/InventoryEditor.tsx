"use client";
import { useEffect, useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight, Package } from "lucide-react";

type Item = {
  id: string;
  room_name: string;
  item_name: string;
  quantity: number;
  weight_lbs: number | null;
  cubic_feet: number | null;
  is_heavy: boolean;
  notes: string | null;
};

type Totals = { total_items: number; total_weight: number; total_cuft: number };

const DEFAULT_ROOMS = [
  "Living Room",
  "Kitchen",
  "Master Bedroom",
  "Bedroom 2",
  "Bedroom 3",
  "Dining Room",
  "Bathroom",
  "Office",
  "Garage",
  "Basement",
  "Attic",
  "Outdoor",
];

const ITEM_CATALOG: { name: string; weight: number; cuft: number; heavy?: boolean }[] = [
  { name: "Sofa (3-seat)", weight: 90, cuft: 35 },
  { name: "Loveseat", weight: 60, cuft: 20 },
  { name: "Recliner", weight: 75, cuft: 18 },
  { name: "Coffee table", weight: 35, cuft: 10 },
  { name: "TV (large)", weight: 30, cuft: 8 },
  { name: "TV stand", weight: 50, cuft: 14 },
  { name: "Bookshelf", weight: 60, cuft: 18 },
  { name: "Queen bed", weight: 100, cuft: 60, heavy: true },
  { name: "King bed", weight: 130, cuft: 75, heavy: true },
  { name: "Twin bed", weight: 60, cuft: 35 },
  { name: "Dresser", weight: 110, cuft: 40, heavy: true },
  { name: "Nightstand", weight: 30, cuft: 10 },
  { name: "Wardrobe", weight: 140, cuft: 50, heavy: true },
  { name: "Dining table", weight: 80, cuft: 30 },
  { name: "Dining chair", weight: 12, cuft: 5 },
  { name: "Kitchen box (dishes)", weight: 30, cuft: 3 },
  { name: "Refrigerator", weight: 250, cuft: 30, heavy: true },
  { name: "Washer", weight: 200, cuft: 8, heavy: true },
  { name: "Dryer", weight: 130, cuft: 8, heavy: true },
  { name: "Piano (upright)", weight: 500, cuft: 30, heavy: true },
  { name: "Piano (grand)", weight: 800, cuft: 60, heavy: true },
  { name: "Safe (small)", weight: 100, cuft: 5, heavy: true },
  { name: "Safe (large)", weight: 600, cuft: 20, heavy: true },
  { name: "Treadmill", weight: 225, cuft: 25, heavy: true },
  { name: "Pool table", weight: 700, cuft: 80, heavy: true },
  { name: "Small box", weight: 25, cuft: 1.5 },
  { name: "Medium box", weight: 40, cuft: 3 },
  { name: "Large box", weight: 65, cuft: 4.5 },
  { name: "Wardrobe box", weight: 50, cuft: 14 },
];

export function InventoryEditor({ opportunityId }: { opportunityId: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [totals, setTotals] = useState<Totals>({ total_items: 0, total_weight: 0, total_cuft: 0 });
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [newRoom, setNewRoom] = useState("");
  const [rooms, setRooms] = useState<string[]>([]);

  async function reload() {
    setLoading(true);
    const j = await fetch(`/api/opportunities/${opportunityId}/inventory`).then((r) => r.json());
    const its: Item[] = j.items ?? [];
    setItems(its);
    setTotals(j.totals ?? { total_items: 0, total_weight: 0, total_cuft: 0 });
    const seen = Array.from(new Set(its.map((i) => i.room_name)));
    setRooms(seen.length > 0 ? seen : []);
    setLoading(false);
  }

  useEffect(() => {
    reload();
  }, [opportunityId]);

  async function addItem(roomName: string, fromCatalog?: typeof ITEM_CATALOG[0]) {
    const payload = fromCatalog
      ? {
          room_name: roomName,
          item_name: fromCatalog.name,
          quantity: 1,
          weight_lbs: fromCatalog.weight,
          cubic_feet: fromCatalog.cuft,
          is_heavy: fromCatalog.heavy ?? false,
        }
      : {
          room_name: roomName,
          item_name: "New item",
          quantity: 1,
          weight_lbs: null,
          cubic_feet: null,
          is_heavy: false,
        };
    await fetch(`/api/opportunities/${opportunityId}/inventory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    reload();
  }

  async function updateItem(itemId: string, patch: Partial<Item>) {
    await fetch(`/api/opportunities/${opportunityId}/inventory/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    reload();
  }

  async function deleteItem(itemId: string) {
    await fetch(`/api/opportunities/${opportunityId}/inventory/${itemId}`, { method: "DELETE" });
    reload();
  }

  function addRoom() {
    if (!newRoom.trim()) return;
    if (!rooms.includes(newRoom.trim())) {
      setRooms([...rooms, newRoom.trim()]);
    }
    setNewRoom("");
    setShowAddRoom(false);
  }

  const itemsByRoom: Record<string, Item[]> = {};
  for (const it of items) {
    if (!itemsByRoom[it.room_name]) itemsByRoom[it.room_name] = [];
    itemsByRoom[it.room_name].push(it);
  }
  const allRooms = Array.from(new Set([...rooms, ...Object.keys(itemsByRoom)]));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <Package className="w-4 h-4 text-muted-foreground" />
            <span className="font-semibold">{totals.total_items}</span>
            <span className="text-muted-foreground">items</span>
          </div>
          <div className="text-sm">
            <span className="font-semibold">{totals.total_weight.toLocaleString()}</span>
            <span className="text-muted-foreground"> lbs</span>
          </div>
          <div className="text-sm">
            <span className="font-semibold">{totals.total_cuft.toLocaleString()}</span>
            <span className="text-muted-foreground"> cu ft</span>
          </div>
        </div>
        <button
          onClick={() => setShowAddRoom(!showAddRoom)}
          className="flex items-center gap-1 text-sm bg-accent text-white px-3 py-1.5 rounded-md"
        >
          <Plus className="w-3 h-3" /> Add Room
        </button>
      </div>

      {showAddRoom && (
        <div className="mb-4 p-3 border border-border rounded-md bg-accent/5">
          <div className="flex gap-2 items-center">
            <select
              value={newRoom}
              onChange={(e) => setNewRoom(e.target.value)}
              className="text-sm border border-border rounded-md px-2 py-1.5 bg-background flex-1"
            >
              <option value="">— Pick a room or type custom —</option>
              {DEFAULT_ROOMS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground">or</span>
            <input
              value={newRoom}
              onChange={(e) => setNewRoom(e.target.value)}
              placeholder="Custom room name"
              className="text-sm border border-border rounded-md px-2 py-1.5 bg-background flex-1"
            />
            <button onClick={addRoom} className="text-sm bg-accent text-white px-3 py-1.5 rounded-md">
              Add
            </button>
          </div>
        </div>
      )}

      {loading && <div className="text-sm text-muted-foreground">Loading inventory…</div>}

      {!loading && allRooms.length === 0 && (
        <div className="text-sm text-muted-foreground border border-dashed border-border rounded-md p-8 text-center">
          No inventory yet. Click &quot;Add Room&quot; to start.
        </div>
      )}

      <div className="space-y-3">
        {allRooms.map((room) => (
          <RoomSection
            key={room}
            room={room}
            items={itemsByRoom[room] ?? []}
            collapsed={collapsed[room] ?? false}
            onToggle={() => setCollapsed({ ...collapsed, [room]: !collapsed[room] })}
            onAddItem={(fc) => addItem(room, fc)}
            onUpdate={updateItem}
            onDelete={deleteItem}
          />
        ))}
      </div>
    </div>
  );
}

function RoomSection({
  room,
  items,
  collapsed,
  onToggle,
  onAddItem,
  onUpdate,
  onDelete,
}: {
  room: string;
  items: Item[];
  collapsed: boolean;
  onToggle: () => void;
  onAddItem: (fromCatalog?: typeof ITEM_CATALOG[0]) => void;
  onUpdate: (id: string, patch: Partial<Item>) => void;
  onDelete: (id: string) => void;
}) {
  const [showCatalog, setShowCatalog] = useState(false);
  const roomWeight = items.reduce((s, i) => s + (i.weight_lbs ?? 0) * i.quantity, 0);

  return (
    <div className="border border-border rounded-md overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 bg-accent/5 hover:bg-accent/10 text-left"
      >
        <div className="flex items-center gap-2">
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          <span className="font-semibold text-sm">{room}</span>
          <span className="text-xs text-muted-foreground">
            ({items.length} item{items.length !== 1 ? "s" : ""}, {roomWeight.toLocaleString()} lbs)
          </span>
        </div>
      </button>

      {!collapsed && (
        <div>
          {items.length > 0 && (
            <table className="w-full text-sm">
              <thead className="bg-accent/5 text-xs">
                <tr>
                  <th className="text-left px-3 py-1.5">Item</th>
                  <th className="text-right px-3 py-1.5 w-16">Qty</th>
                  <th className="text-right px-3 py-1.5 w-20">Weight</th>
                  <th className="text-right px-3 py-1.5 w-20">Cu ft</th>
                  <th className="text-center px-3 py-1.5 w-16">Heavy</th>
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <ItemRow key={it.id} item={it} onUpdate={onUpdate} onDelete={onDelete} />
                ))}
              </tbody>
            </table>
          )}

          <div className="p-2 border-t border-border flex gap-2 items-center">
            <button
              onClick={() => onAddItem()}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-border hover:bg-accent/5"
            >
              <Plus className="w-3 h-3" /> Add custom item
            </button>
            <button
              onClick={() => setShowCatalog(!showCatalog)}
              className="text-xs px-2 py-1 rounded border border-border hover:bg-accent/5"
            >
              {showCatalog ? "Hide" : "Show"} item catalog
            </button>
          </div>

          {showCatalog && (
            <div className="p-2 border-t border-border bg-accent/5 max-h-60 overflow-y-auto">
              <div className="grid grid-cols-3 gap-1 text-xs">
                {ITEM_CATALOG.map((c) => (
                  <button
                    key={c.name}
                    onClick={() => {
                      onAddItem(c);
                      setShowCatalog(false);
                    }}
                    className="text-left px-2 py-1.5 rounded border border-border bg-background hover:bg-accent/10 truncate"
                    title={`${c.weight} lbs / ${c.cuft} cu ft${c.heavy ? " (heavy)" : ""}`}
                  >
                    {c.name}
                    {c.heavy && <span className="text-amber-600 ml-1">●</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ItemRow({
  item,
  onUpdate,
  onDelete,
}: {
  item: Item;
  onUpdate: (id: string, patch: Partial<Item>) => void;
  onDelete: (id: string) => void;
}) {
  const [local, setLocal] = useState(item);

  return (
    <tr className="border-t border-border">
      <td className="px-3 py-1.5">
        <input
          value={local.item_name}
          onChange={(e) => setLocal({ ...local, item_name: e.target.value })}
          onBlur={() => onUpdate(item.id, { item_name: local.item_name })}
          className="text-xs border border-transparent hover:border-border focus:border-accent rounded px-1 py-0.5 bg-transparent w-full"
        />
      </td>
      <td className="px-3 py-1.5">
        <input
          type="number"
          min="1"
          value={local.quantity}
          onChange={(e) => setLocal({ ...local, quantity: parseInt(e.target.value) || 1 })}
          onBlur={() => onUpdate(item.id, { quantity: local.quantity })}
          className="text-xs border border-border rounded px-1 py-0.5 bg-background w-12 text-right"
        />
      </td>
      <td className="px-3 py-1.5">
        <input
          type="number"
          step="1"
          value={local.weight_lbs ?? ""}
          onChange={(e) =>
            setLocal({ ...local, weight_lbs: e.target.value ? parseFloat(e.target.value) : null })
          }
          onBlur={() => onUpdate(item.id, { weight_lbs: local.weight_lbs })}
          placeholder="—"
          className="text-xs border border-border rounded px-1 py-0.5 bg-background w-16 text-right"
        />
      </td>
      <td className="px-3 py-1.5">
        <input
          type="number"
          step="0.5"
          value={local.cubic_feet ?? ""}
          onChange={(e) =>
            setLocal({ ...local, cubic_feet: e.target.value ? parseFloat(e.target.value) : null })
          }
          onBlur={() => onUpdate(item.id, { cubic_feet: local.cubic_feet })}
          placeholder="—"
          className="text-xs border border-border rounded px-1 py-0.5 bg-background w-16 text-right"
        />
      </td>
      <td className="px-3 py-1.5 text-center">
        <input
          type="checkbox"
          checked={local.is_heavy}
          onChange={(e) => {
            setLocal({ ...local, is_heavy: e.target.checked });
            onUpdate(item.id, { is_heavy: e.target.checked });
          }}
        />
      </td>
      <td className="px-2 py-1.5 text-center">
        <button onClick={() => onDelete(item.id)} className="text-red-500 hover:text-red-700">
          <Trash2 className="w-3 h-3" />
        </button>
      </td>
    </tr>
  );
}
