"use client";
import { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";

type Tier = { id: string; threshold: number; rate: number };
type Rate = {
  id: string;
  kind: string;
  label: string | null;
  base_rate: number;
  min_charge: number;
  unit: string;
  tiers?: Tier[];
};

const KIND_OPTIONS = [
  { value: "labor", label: "Labor" },
  { value: "truck", label: "Truck" },
  { value: "material", label: "Material" },
  { value: "packing", label: "Packing" },
  { value: "travel", label: "Travel" },
  { value: "flat", label: "Flat fee" },
  { value: "mileage", label: "Mileage" },
];

const UNIT_OPTIONS = [
  { value: "hour", label: "per hour" },
  { value: "mile", label: "per mile" },
  { value: "cwt", label: "per 100 lbs" },
  { value: "flat", label: "flat" },
  { value: "each", label: "each" },
  { value: "day", label: "per day" },
];

export function TariffRateEditor({
  tariffId,
  rates,
  onChange,
}: {
  tariffId: string;
  rates: Rate[];
  onChange: () => void;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  async function addRate() {
    await fetch(`/api/tariffs/${tariffId}/rates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "labor", label: "New rate", base_rate: 0, min_charge: 0, unit: "hour" }),
    });
    onChange();
  }

  async function updateRate(rateId: string, patch: Partial<Rate>) {
    setSavingId(rateId);
    await fetch(`/api/tariffs/${tariffId}/rates/${rateId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setSavingId(null);
    onChange();
  }

  async function deleteRate(rateId: string) {
    if (!confirm("Delete this rate?")) return;
    await fetch(`/api/tariffs/${tariffId}/rates/${rateId}`, { method: "DELETE" });
    onChange();
  }

  async function addTier(rateId: string) {
    await fetch(`/api/tariffs/${tariffId}/rates/${rateId}/tiers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threshold: 0, rate: 0 }),
    });
    onChange();
  }

  async function deleteTier(rateId: string, tierId: string) {
    await fetch(`/api/tariffs/${tariffId}/rates/${rateId}/tiers?tier_id=${tierId}`, { method: "DELETE" });
    onChange();
  }

  return (
    <div>
      <div className="border border-border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-accent/5 text-xs">
            <tr>
              <th className="w-8"></th>
              <th className="text-left px-3 py-2 w-24">Kind</th>
              <th className="text-left px-3 py-2">Label</th>
              <th className="text-right px-3 py-2 w-28">Base rate</th>
              <th className="text-right px-3 py-2 w-28">Min charge</th>
              <th className="text-left px-3 py-2 w-28">Unit</th>
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody>
            {rates.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-xs text-muted-foreground py-4">
                  No rates yet. Add one below.
                </td>
              </tr>
            )}
            {rates.map((r) => (
              <RateRow
                key={r.id}
                rate={r}
                expanded={expanded[r.id] ?? false}
                onToggleExpand={() => setExpanded({ ...expanded, [r.id]: !expanded[r.id] })}
                saving={savingId === r.id}
                onUpdate={(patch) => updateRate(r.id, patch)}
                onDelete={() => deleteRate(r.id)}
                onAddTier={() => addTier(r.id)}
                onDeleteTier={(tierId) => deleteTier(r.id, tierId)}
              />
            ))}
          </tbody>
        </table>
      </div>
      <button
        onClick={addRate}
        className="mt-3 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border hover:bg-accent/5"
      >
        <Plus className="w-3 h-3" /> Add rate
      </button>
    </div>
  );
}

function RateRow({
  rate,
  expanded,
  onToggleExpand,
  saving,
  onUpdate,
  onDelete,
  onAddTier,
  onDeleteTier,
}: {
  rate: Rate;
  expanded: boolean;
  onToggleExpand: () => void;
  saving: boolean;
  onUpdate: (patch: Partial<Rate>) => void;
  onDelete: () => void;
  onAddTier: () => void;
  onDeleteTier: (tierId: string) => void;
}) {
  const [local, setLocal] = useState(rate);

  function commit(patch: Partial<Rate>) {
    setLocal({ ...local, ...patch });
    onUpdate(patch);
  }

  return (
    <>
      <tr className="border-t border-border">
        <td className="px-2 py-2">
          <button onClick={onToggleExpand} className="text-muted-foreground">
            {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
        </td>
        <td className="px-3 py-2">
          <select
            value={local.kind}
            onChange={(e) => commit({ kind: e.target.value })}
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
        <td className="px-3 py-2 text-right">
          <input
            type="number"
            step="0.01"
            value={local.base_rate}
            onChange={(e) => setLocal({ ...local, base_rate: parseFloat(e.target.value) || 0 })}
            onBlur={() => onUpdate({ base_rate: local.base_rate })}
            className="text-xs border border-border rounded px-2 py-1 bg-background w-24 text-right"
          />
        </td>
        <td className="px-3 py-2 text-right">
          <input
            type="number"
            step="0.01"
            value={local.min_charge}
            onChange={(e) => setLocal({ ...local, min_charge: parseFloat(e.target.value) || 0 })}
            onBlur={() => onUpdate({ min_charge: local.min_charge })}
            className="text-xs border border-border rounded px-2 py-1 bg-background w-24 text-right"
          />
        </td>
        <td className="px-3 py-2">
          <select
            value={local.unit}
            onChange={(e) => commit({ unit: e.target.value })}
            className="text-xs border border-border rounded px-1.5 py-1 bg-background w-full"
          >
            {UNIT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </td>
        <td className="px-2 py-2 text-center">
          <button onClick={onDelete} className="text-red-500 hover:text-red-700">
            <Trash2 className="w-3 h-3" />
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-accent/5">
          <td></td>
          <td colSpan={6} className="px-3 py-3">
            <div className="text-xs font-semibold mb-2">Tiered pricing (volume breaks)</div>
            {(rate.tiers ?? []).length === 0 && (
              <div className="text-xs text-muted-foreground mb-2">
                No tiers. Add one to charge a different rate above a threshold (e.g. above 8 hours).
              </div>
            )}
            <div className="space-y-1">
              {(rate.tiers ?? []).map((t) => (
                <div key={t.id} className="flex items-center gap-2 text-xs">
                  <span>Above {t.threshold} units →</span>
                  <span className="font-mono">${t.rate}/unit</span>
                  <button onClick={() => onDeleteTier(t.id)} className="text-red-500 ml-2">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={onAddTier}
              className="mt-2 flex items-center gap-1 text-xs px-2 py-1 rounded border border-border"
            >
              <Plus className="w-3 h-3" /> Add tier
            </button>
            {saving && <span className="text-xs text-muted-foreground ml-2">Saving…</span>}
          </td>
        </tr>
      )}
    </>
  );
}
