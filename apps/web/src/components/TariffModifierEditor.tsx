"use client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

type Modifier = {
  id: string;
  kind: string;
  label: string | null;
  formula_json: { type: string; value: number; condition?: Record<string, unknown> };
  stacking_order: number;
};

const KIND_OPTIONS = [
  { value: "fuel_surcharge", label: "Fuel surcharge" },
  { value: "long_carry", label: "Long carry" },
  { value: "stairs", label: "Stairs" },
  { value: "heavy_item", label: "Heavy item" },
  { value: "weekend", label: "Weekend" },
  { value: "holiday", label: "Holiday" },
  { value: "peak_season", label: "Peak season" },
  { value: "elevator", label: "Elevator" },
  { value: "shuttle", label: "Shuttle" },
];

const FORMULA_TYPES = [
  { value: "percentage", label: "% of labor+truck" },
  { value: "flat", label: "Flat amount" },
  { value: "per_flight", label: "Per flight of stairs" },
  { value: "per_100lbs", label: "Per 100 lbs" },
  { value: "per_item", label: "Per heavy item" },
];

export function TariffModifierEditor({
  tariffId,
  modifiers,
  onChange,
}: {
  tariffId: string;
  modifiers: Modifier[];
  onChange: () => void;
}) {
  async function addModifier() {
    await fetch(`/api/tariffs/${tariffId}/modifiers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "fuel_surcharge",
        label: "New modifier",
        formula_json: { type: "percentage", value: 0 },
        stacking_order: (modifiers.length + 1) * 10,
      }),
    });
    onChange();
  }

  async function deleteModifier(modId: string) {
    if (!confirm("Delete this modifier?")) return;
    await fetch(`/api/tariffs/${tariffId}/modifiers/${modId}`, { method: "DELETE" });
    onChange();
  }

  async function updateModifier(modId: string, patch: Partial<Modifier>) {
    await fetch(`/api/tariffs/${tariffId}/modifiers/${modId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    onChange();
  }

  return (
    <div>
      <div className="border border-border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-accent/5 text-xs">
            <tr>
              <th className="text-left px-3 py-2 w-32">Kind</th>
              <th className="text-left px-3 py-2">Label</th>
              <th className="text-left px-3 py-2 w-44">Formula</th>
              <th className="text-right px-3 py-2 w-24">Value</th>
              <th className="text-right px-3 py-2 w-20">Order</th>
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody>
            {modifiers.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-xs text-muted-foreground py-4">
                  No modifiers. Add fuel surcharge, weekend rate, etc.
                </td>
              </tr>
            )}
            {modifiers.map((m) => (
              <ModifierRow
                key={m.id}
                modifier={m}
                onUpdate={(p) => updateModifier(m.id, p)}
                onDelete={() => deleteModifier(m.id)}
              />
            ))}
          </tbody>
        </table>
      </div>
      <button
        onClick={addModifier}
        className="mt-3 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border hover:bg-accent/5"
      >
        <Plus className="w-3 h-3" /> Add modifier
      </button>
    </div>
  );
}

function ModifierRow({
  modifier,
  onUpdate,
  onDelete,
}: {
  modifier: Modifier;
  onUpdate: (p: Partial<Modifier>) => void;
  onDelete: () => void;
}) {
  const [local, setLocal] = useState(modifier);

  function commitFormula(patch: Partial<Modifier["formula_json"]>) {
    const newFormula = { ...local.formula_json, ...patch };
    setLocal({ ...local, formula_json: newFormula });
    onUpdate({ formula_json: newFormula });
  }

  return (
    <tr className="border-t border-border">
      <td className="px-3 py-2">
        <select
          value={local.kind}
          onChange={(e) => {
            setLocal({ ...local, kind: e.target.value });
            onUpdate({ kind: e.target.value });
          }}
          className="text-xs border border-border rounded px-1.5 py-1 bg-background w-full"
        >
          {KIND_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2">
        <input
          value={local.label ?? ""}
          onChange={(e) => setLocal({ ...local, label: e.target.value })}
          onBlur={() => onUpdate({ label: local.label })}
          placeholder="(optional)"
          className="text-xs border border-border rounded px-2 py-1 bg-background w-full"
        />
      </td>
      <td className="px-3 py-2">
        <select
          value={local.formula_json.type}
          onChange={(e) => commitFormula({ type: e.target.value })}
          className="text-xs border border-border rounded px-1.5 py-1 bg-background w-full"
        >
          {FORMULA_TYPES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2 text-right">
        <input
          type="number"
          step="0.01"
          value={local.formula_json.value}
          onChange={(e) =>
            setLocal({
              ...local,
              formula_json: { ...local.formula_json, value: parseFloat(e.target.value) || 0 },
            })
          }
          onBlur={() => commitFormula({ value: local.formula_json.value })}
          className="text-xs border border-border rounded px-2 py-1 bg-background w-20 text-right"
        />
      </td>
      <td className="px-3 py-2 text-right">
        <input
          type="number"
          value={local.stacking_order}
          onChange={(e) => setLocal({ ...local, stacking_order: parseInt(e.target.value) || 0 })}
          onBlur={() => onUpdate({ stacking_order: local.stacking_order })}
          className="text-xs border border-border rounded px-2 py-1 bg-background w-16 text-right"
        />
      </td>
      <td className="px-2 py-2 text-center">
        <button onClick={onDelete} className="text-red-500 hover:text-red-700">
          <Trash2 className="w-3 h-3" />
        </button>
      </td>
    </tr>
  );
}
