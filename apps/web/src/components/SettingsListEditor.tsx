"use client";
import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

type ListItem = { value: string; label: string };

/**
 * Reusable editor for settings that are simple lists of {value, label} items.
 * Stores the array as a JSON value on a single settings row at category/settingKey.
 */
export function SettingsListEditor({
  category,
  settingKey,
  defaults = [],
  itemNoun = "item",
}: {
  category: string;
  settingKey: string;
  defaults?: ListItem[];
  itemNoun?: string;
}) {
  const [items, setItems] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newValue, setNewValue] = useState("");
  const [newLabel, setNewLabel] = useState("");

  async function reload() {
    setLoading(true);
    const j = await fetch(`/api/settings/${category}`).then((r) => r.json());
    const row = (j.settings ?? []).find((s: { key: string }) => s.key === settingKey);
    if (row && Array.isArray(row.value)) setItems(row.value as ListItem[]);
    else setItems(defaults);
    setLoading(false);
  }

  useEffect(() => {
    reload();
  }, [category, settingKey]);

  async function save(next: ListItem[]) {
    setItems(next);
    await fetch(`/api/settings/${category}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: settingKey, value: next }),
    });
  }

  function addItem() {
    if (!newValue.trim() || !newLabel.trim()) return;
    save([...items, { value: newValue.trim(), label: newLabel.trim() }]);
    setNewValue("");
    setNewLabel("");
  }

  function removeItem(i: number) {
    save(items.filter((_, idx) => idx !== i));
  }

  function updateItem(i: number, patch: Partial<ListItem>) {
    save(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div>
      <div className="border border-border rounded-md overflow-hidden mb-3">
        <table className="w-full text-sm">
          <thead className="bg-accent/5 text-xs">
            <tr>
              <th className="text-left px-3 py-2 w-44">Value (slug)</th>
              <th className="text-left px-3 py-2">Label</th>
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={3} className="text-center text-xs text-muted-foreground py-4">
                  No {itemNoun}s yet.
                </td>
              </tr>
            )}
            {items.map((it, i) => (
              <tr key={i} className="border-t border-border">
                <td className="px-3 py-2">
                  <input
                    value={it.value}
                    onChange={(e) => updateItem(i, { value: e.target.value })}
                    className="text-xs border border-border rounded px-2 py-1 bg-background w-full font-mono"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    value={it.label}
                    onChange={(e) => updateItem(i, { label: e.target.value })}
                    className="text-xs border border-border rounded px-2 py-1 bg-background w-full"
                  />
                </td>
                <td className="px-2 py-2 text-center">
                  <button onClick={() => removeItem(i)} className="text-red-500 hover:text-red-700">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <label className="text-xs text-muted-foreground block mb-1">Value</label>
          <input
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="e.g. residential"
            className="text-sm border border-border rounded-md px-2 py-1.5 bg-background w-full font-mono"
          />
        </div>
        <div className="flex-1">
          <label className="text-xs text-muted-foreground block mb-1">Label</label>
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="e.g. Residential"
            className="text-sm border border-border rounded-md px-2 py-1.5 bg-background w-full"
          />
        </div>
        <button
          onClick={addItem}
          className="flex items-center gap-1 text-sm bg-accent text-white px-3 py-1.5 rounded-md"
        >
          <Plus className="w-3 h-3" /> Add
        </button>
      </div>
    </div>
  );
}
