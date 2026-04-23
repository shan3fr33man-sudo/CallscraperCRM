"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

type Shop = {
  id: string;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  is_active: boolean;
};

export default function ShopsSettingsPage() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [creating, setCreating] = useState(false);

  async function reload() {
    setLoading(true);
    const r = await fetch("/api/shops").then((r) => r.json());
    setShops(r.shops ?? []);
    setLoading(false);
  }
  useEffect(() => {
    reload();
  }, []);

  async function createShop() {
    if (!name.trim() || !address.trim()) return;
    setCreating(true);
    await fetch("/api/shops", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, address }),
    });
    setName("");
    setAddress("");
    setCreating(false);
    reload();
  }

  async function deactivate(id: string) {
    if (!confirm("Deactivate this yard? Estimator will stop using it for deadhead calculations.")) return;
    await fetch(`/api/shops/${id}`, { method: "DELETE" });
    reload();
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold">Dispatch Yards</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Physical yards where crews and trucks dispatch from. The estimator
        picks the closest yard to each job's origin address to calculate
        deadhead (origin-travel) fees on long-distance estimates. Add one or
        more per brand.
      </p>

      <div className="mt-6 rounded-lg border p-4">
        <h2 className="text-sm font-medium mb-3">Add a yard</h2>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded border px-3 py-2 text-sm"
            placeholder="Yard name (e.g. 'Everett HQ')"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="flex-[2] rounded border px-3 py-2 text-sm"
            placeholder="Full street address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <button
            className="flex items-center gap-1 rounded bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
            onClick={createShop}
            disabled={creating || !name.trim() || !address.trim()}
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-lg border">
        <div className="border-b p-3 text-sm font-medium">
          Active yards ({shops.filter((s) => s.is_active).length})
        </div>
        {loading ? (
          <div className="p-4 text-sm text-muted-foreground">Loading…</div>
        ) : shops.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">
            No yards yet. Add one above. Long-distance estimates will skip
            deadhead fees until at least one yard exists.
          </div>
        ) : (
          <ul className="divide-y">
            {shops.map((s) => (
              <li key={s.id} className="flex items-center justify-between p-3">
                <div>
                  <div className="text-sm font-medium">
                    {s.name}
                    {!s.is_active && <span className="ml-2 text-xs text-muted-foreground">(inactive)</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">{s.address}</div>
                </div>
                {s.is_active && (
                  <button
                    className="flex items-center gap-1 text-sm text-red-600 hover:text-red-700"
                    onClick={() => deactivate(s.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Deactivate
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
