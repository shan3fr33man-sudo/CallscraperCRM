"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Trash2, Plus } from "lucide-react";
import { TariffRateEditor } from "@/components/TariffRateEditor";
import { TariffModifierEditor } from "@/components/TariffModifierEditor";
import { PricingPreview } from "@/components/PricingPreview";

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
type Modifier = {
  id: string;
  kind: string;
  label: string | null;
  formula_json: { type: string; value: number; condition?: Record<string, unknown> };
  stacking_order: number;
};
type Valuation = {
  id: string;
  name: string;
  coverage_type: string;
  deductible: number;
  rate_per_thousand: number;
};
type Handicap = {
  id: string;
  name: string;
  multiplier: number;
  condition_json: Record<string, unknown>;
};
type Assignment = {
  id: string;
  branch_id: string | null;
  opportunity_type: string | null;
  service_type: string | null;
  priority: number;
};

type FullTariff = {
  id: string;
  name: string;
  branch_id: string | null;
  service_type: string | null;
  effective_from: string | null;
  effective_to: string | null;
  currency: string;
  rounding_rule: string;
  is_default: boolean;
  archived: boolean;
  rates: Rate[];
  modifiers: Modifier[];
  valuations: Valuation[];
  handicaps: Handicap[];
  assignments: Assignment[];
};

type Branch = { id: string; name: string; brand_code: string };

export default function TariffEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [tariff, setTariff] = useState<FullTariff | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [saving, setSaving] = useState(false);

  async function reload() {
    const [tRes, bRes] = await Promise.all([
      fetch(`/api/tariffs/${id}`).then((r) => r.json()),
      fetch("/api/branches").then((r) => r.json()),
    ]);
    setTariff(tRes.tariff);
    setBranches(bRes.branches ?? []);
  }

  useEffect(() => {
    reload();
  }, [id]);

  async function saveHeader(patch: Partial<FullTariff>) {
    setSaving(true);
    await fetch(`/api/tariffs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setSaving(false);
    reload();
  }

  async function archive() {
    if (!confirm("Archive this tariff? It will no longer be applied to new estimates.")) return;
    await fetch(`/api/tariffs/${id}`, { method: "DELETE" });
    router.push("/settings/tariffs/library");
  }

  if (!tariff) {
    return (
      <div className="p-6">
        <div className="text-sm text-muted-foreground">Loading tariff…</div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Main editor column */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => router.push("/settings/tariffs/library")}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="w-3 h-3" /> Back to library
          </button>

          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              <input
                value={tariff.name}
                onChange={(e) => setTariff({ ...tariff, name: e.target.value })}
                onBlur={() => saveHeader({ name: tariff.name })}
                className="text-2xl font-semibold bg-transparent border-b border-transparent hover:border-border focus:border-accent outline-none w-full"
              />
              <div className="text-xs text-muted-foreground mt-1">
                Tariff ID: <code>{tariff.id}</code>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {saving && <span className="text-xs text-muted-foreground flex items-center gap-1"><Save className="w-3 h-3" />Saving…</span>}
              <button
                onClick={archive}
                className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded border border-transparent hover:border-red-200"
              >
                <Trash2 className="w-3 h-3" /> Archive
              </button>
            </div>
          </div>

          {/* Header fields */}
          <div className="grid grid-cols-2 gap-3 mb-6 p-4 border border-border rounded-md bg-accent/5">
            <Field label="Branch">
              <select
                value={tariff.branch_id ?? ""}
                onChange={(e) => saveHeader({ branch_id: e.target.value || null })}
                className="text-sm border border-border rounded-md px-3 py-1.5 bg-background w-full"
              >
                <option value="">— Any branch —</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.brand_code})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Service type">
              <select
                value={tariff.service_type ?? ""}
                onChange={(e) => saveHeader({ service_type: e.target.value || null })}
                className="text-sm border border-border rounded-md px-3 py-1.5 bg-background w-full"
              >
                <option value="">— Any —</option>
                <option value="local_move">Local Move</option>
                <option value="long_distance">Long Distance</option>
                <option value="commercial">Commercial</option>
                <option value="labor_only">Labor Only</option>
                <option value="packing">Packing</option>
                <option value="storage">Storage</option>
              </select>
            </Field>
            <Field label="Effective from">
              <input
                type="date"
                value={tariff.effective_from ?? ""}
                onChange={(e) => saveHeader({ effective_from: e.target.value || null })}
                className="text-sm border border-border rounded-md px-3 py-1.5 bg-background w-full"
              />
            </Field>
            <Field label="Effective to (optional)">
              <input
                type="date"
                value={tariff.effective_to ?? ""}
                onChange={(e) => saveHeader({ effective_to: e.target.value || null })}
                className="text-sm border border-border rounded-md px-3 py-1.5 bg-background w-full"
              />
            </Field>
            <Field label="Rounding rule">
              <select
                value={tariff.rounding_rule}
                onChange={(e) => saveHeader({ rounding_rule: e.target.value })}
                className="text-sm border border-border rounded-md px-3 py-1.5 bg-background w-full"
              >
                <option value="nearest_cent">Nearest cent</option>
                <option value="nearest_dollar">Nearest dollar</option>
                <option value="ceil_dollar">Round up to dollar</option>
                <option value="floor_dollar">Round down to dollar</option>
                <option value="none">No rounding</option>
              </select>
            </Field>
            <Field label="Default tariff">
              <label className="flex items-center gap-2 text-sm pt-2">
                <input
                  type="checkbox"
                  checked={tariff.is_default}
                  onChange={(e) => saveHeader({ is_default: e.target.checked })}
                />
                Use as default when no assignment matches
              </label>
            </Field>
          </div>

          {/* Rates */}
          <Section title="Base Rates">
            <TariffRateEditor tariffId={id} rates={tariff.rates} onChange={reload} />
          </Section>

          {/* Modifiers */}
          <Section title="Modifiers">
            <TariffModifierEditor tariffId={id} modifiers={tariff.modifiers} onChange={reload} />
          </Section>

          {/* Valuations */}
          <Section title="Valuations">
            <ValuationsTable tariffId={id} valuations={tariff.valuations} onChange={reload} />
          </Section>

          {/* Handicaps */}
          <Section title="Handicaps">
            <HandicapsTable tariffId={id} handicaps={tariff.handicaps} onChange={reload} />
          </Section>

          {/* Assignments */}
          <Section title="Assignments">
            <AssignmentsTable
              tariffId={id}
              assignments={tariff.assignments}
              branches={branches}
              onChange={reload}
            />
          </Section>
        </div>
      </div>

      {/* Right preview pane */}
      <div className="w-96 border-l border-border overflow-y-auto p-4 bg-background">
        <PricingPreview tariffId={id} />
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-sm font-semibold mb-3">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
      {children}
    </div>
  );
}

function ValuationsTable({
  tariffId,
  valuations,
  onChange,
}: {
  tariffId: string;
  valuations: Valuation[];
  onChange: () => void;
}) {
  async function add() {
    await fetch(`/api/tariffs/${tariffId}/valuations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "New valuation",
        coverage_type: "released_value",
        deductible: 0,
        rate_per_thousand: 0,
      }),
    });
    onChange();
  }
  async function remove(valId: string) {
    if (!confirm("Delete?")) return;
    await fetch(`/api/tariffs/${tariffId}/valuations?valuation_id=${valId}`, { method: "DELETE" });
    onChange();
  }
  return (
    <div>
      <div className="border border-border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-accent/5 text-xs">
            <tr>
              <th className="text-left px-3 py-2">Name</th>
              <th className="text-left px-3 py-2 w-44">Coverage type</th>
              <th className="text-right px-3 py-2 w-28">Deductible</th>
              <th className="text-right px-3 py-2 w-32">Rate per $1000</th>
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody>
            {valuations.length === 0 && (
              <tr><td colSpan={5} className="text-center text-xs text-muted-foreground py-4">No valuations.</td></tr>
            )}
            {valuations.map((v) => (
              <tr key={v.id} className="border-t border-border">
                <td className="px-3 py-2">{v.name}</td>
                <td className="px-3 py-2 text-xs">{v.coverage_type}</td>
                <td className="px-3 py-2 text-right font-mono text-xs">${v.deductible}</td>
                <td className="px-3 py-2 text-right font-mono text-xs">${v.rate_per_thousand}</td>
                <td className="px-2 py-2 text-center">
                  <button onClick={() => remove(v.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-3 h-3" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button onClick={add} className="mt-3 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border hover:bg-accent/5">
        <Plus className="w-3 h-3" /> Add valuation
      </button>
    </div>
  );
}

function HandicapsTable({
  tariffId,
  handicaps,
  onChange,
}: {
  tariffId: string;
  handicaps: Handicap[];
  onChange: () => void;
}) {
  async function add() {
    await fetch(`/api/tariffs/${tariffId}/handicaps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New handicap", multiplier: 1, condition_json: {} }),
    });
    onChange();
  }
  async function remove(hId: string) {
    if (!confirm("Delete?")) return;
    await fetch(`/api/tariffs/${tariffId}/handicaps?handicap_id=${hId}`, { method: "DELETE" });
    onChange();
  }
  return (
    <div>
      <div className="border border-border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-accent/5 text-xs">
            <tr>
              <th className="text-left px-3 py-2">Name</th>
              <th className="text-right px-3 py-2 w-28">Multiplier</th>
              <th className="text-left px-3 py-2">Condition</th>
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody>
            {handicaps.length === 0 && (
              <tr><td colSpan={4} className="text-center text-xs text-muted-foreground py-4">No handicaps.</td></tr>
            )}
            {handicaps.map((h) => (
              <tr key={h.id} className="border-t border-border">
                <td className="px-3 py-2">{h.name}</td>
                <td className="px-3 py-2 text-right font-mono text-xs">{h.multiplier}x</td>
                <td className="px-3 py-2 text-xs font-mono">{JSON.stringify(h.condition_json)}</td>
                <td className="px-2 py-2 text-center">
                  <button onClick={() => remove(h.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-3 h-3" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button onClick={add} className="mt-3 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border hover:bg-accent/5">
        <Plus className="w-3 h-3" /> Add handicap
      </button>
    </div>
  );
}

function AssignmentsTable({
  tariffId,
  assignments,
  branches,
  onChange,
}: {
  tariffId: string;
  assignments: Assignment[];
  branches: Branch[];
  onChange: () => void;
}) {
  async function add() {
    await fetch(`/api/tariffs/${tariffId}/assignments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ branch_id: null, service_type: null, opportunity_type: null, priority: 0 }),
    });
    onChange();
  }
  async function remove(aId: string) {
    if (!confirm("Delete?")) return;
    await fetch(`/api/tariffs/${tariffId}/assignments?assignment_id=${aId}`, { method: "DELETE" });
    onChange();
  }
  function branchName(id: string | null): string {
    if (!id) return "Any";
    return branches.find((b) => b.id === id)?.name ?? "Unknown";
  }
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-2">
        When this tariff applies. Higher priority wins ties.
      </div>
      <div className="border border-border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-accent/5 text-xs">
            <tr>
              <th className="text-left px-3 py-2">Branch</th>
              <th className="text-left px-3 py-2">Service type</th>
              <th className="text-left px-3 py-2">Opportunity type</th>
              <th className="text-right px-3 py-2 w-20">Priority</th>
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody>
            {assignments.length === 0 && (
              <tr><td colSpan={5} className="text-center text-xs text-muted-foreground py-4">No assignments — this tariff won&apos;t auto-apply.</td></tr>
            )}
            {assignments.map((a) => (
              <tr key={a.id} className="border-t border-border">
                <td className="px-3 py-2 text-xs">{branchName(a.branch_id)}</td>
                <td className="px-3 py-2 text-xs">{a.service_type ?? "Any"}</td>
                <td className="px-3 py-2 text-xs">{a.opportunity_type ?? "Any"}</td>
                <td className="px-3 py-2 text-right font-mono text-xs">{a.priority}</td>
                <td className="px-2 py-2 text-center">
                  <button onClick={() => remove(a.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-3 h-3" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button onClick={add} className="mt-3 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border hover:bg-accent/5">
        <Plus className="w-3 h-3" /> Add assignment
      </button>
    </div>
  );
}
