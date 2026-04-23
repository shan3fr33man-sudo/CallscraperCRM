"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, AlertCircle } from "lucide-react";

/**
 * Per-brand rate card + cost structure editor.
 *
 * Each brand gets its own editable card: revenue side (rate card) on the left,
 * cost side on the right, and a live margin preview underneath. "Placeholder"
 * configs show a yellow banner so the operator knows to tune them before the
 * auto-estimator goes live.
 */

type BranchConfig = {
  id: string;
  brand_code: string;
  brand_display_name: string;
  rate_base_2man_1truck: number | null;
  rate_per_extra_man: number | null;
  rate_per_extra_truck: number | null;
  burdened_per_worker_hour: number | null;
  truck_cost_per_hour: number | null;
  deadhead_cost_per_mile: number | null;
  sales_tax_pct: number | null;
  default_shuttle_fee: number | null;
  default_long_haul_prep_fee: number | null;
  default_tv_crating_fee: number | null;
  default_specialty_fee: number | null;
  default_fuel_surcharge_pct: number | null;
  linehaul_rate_mode: "min" | "midpoint" | "max" | "custom" | null;
  linehaul_rate_custom_per_lb: number | null;
  wage_average_per_hour: number | null;
  is_placeholder: boolean;
  notes: string | null;
};

export default function BranchConfigPage() {
  const [configs, setConfigs] = useState<BranchConfig[]>([]);
  const [loading, setLoading] = useState(true);

  async function reload() {
    setLoading(true);
    const r = await fetch("/api/estimator-branch-config").then((r) => r.json());
    setConfigs(r.configs ?? []);
    setLoading(false);
  }
  useEffect(() => {
    reload();
  }, []);

  if (loading) {
    return (
      <div className="p-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading configs…
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Per-Brand Rate Card & Cost Structure</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Revenue rates (what you bill) on the left, cost inputs (what it costs you) on the right.
          The estimator uses these to predict hours, compute margin, and decide whether to auto-send
          or flag for agent review. Tune any field live — changes take effect on the next estimate.
        </p>
      </div>

      <div className="space-y-4">
        {configs.map((c) => (
          <BrandCard key={c.id} config={c} onSaved={reload} />
        ))}
      </div>
    </div>
  );
}

function BrandCard({ config, onSaved }: { config: BranchConfig; onSaved: () => void }) {
  const [form, setForm] = useState<BranchConfig>(config);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  function set<K extends keyof BranchConfig>(key: K, value: BranchConfig[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaveMsg(null);
  }

  async function save() {
    setSaving(true);
    setSaveMsg(null);
    // Only send fields the server whitelists — omitting id/brand_display_name/
    // is_placeholder avoids noisy request bodies and protects against any
    // future whitelist tightening.
    const payload: Record<string, unknown> = {
      brand_code: form.brand_code,
      rate_base_2man_1truck: form.rate_base_2man_1truck,
      rate_per_extra_man: form.rate_per_extra_man,
      rate_per_extra_truck: form.rate_per_extra_truck,
      burdened_per_worker_hour: form.burdened_per_worker_hour,
      truck_cost_per_hour: form.truck_cost_per_hour,
      deadhead_cost_per_mile: form.deadhead_cost_per_mile,
      sales_tax_pct: form.sales_tax_pct,
      default_shuttle_fee: form.default_shuttle_fee,
      default_long_haul_prep_fee: form.default_long_haul_prep_fee,
      default_tv_crating_fee: form.default_tv_crating_fee,
      default_specialty_fee: form.default_specialty_fee,
      default_fuel_surcharge_pct: form.default_fuel_surcharge_pct,
      linehaul_rate_mode: form.linehaul_rate_mode,
      linehaul_rate_custom_per_lb: form.linehaul_rate_custom_per_lb,
      wage_average_per_hour: form.wage_average_per_hour,
      notes: form.notes,
    };
    try {
      const res = await fetch("/api/estimator-branch-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) {
        setSaveMsg(`Error: ${j.error ?? "save failed"}`);
      } else {
        setSaveMsg("Saved.");
        onSaved();
      }
    } catch (e) {
      setSaveMsg(`Error: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  // Live margin sanity at the 3-man 5-hour local scenario.
  const revenue3x5 =
    5 *
    ((Number(form.rate_base_2man_1truck) || 0) + (Number(form.rate_per_extra_man) || 0));
  const cost3x5 =
    5 *
    (3 * (Number(form.burdened_per_worker_hour) || 0) +
      (Number(form.truck_cost_per_hour) || 0));
  const margin3x5 = revenue3x5 > 0 ? ((revenue3x5 - cost3x5) / revenue3x5) * 100 : 0;

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div>
          <h2 className="text-base font-semibold">
            {form.brand_display_name}
            <span className="ml-2 text-xs font-mono text-muted-foreground">
              brand_code={form.brand_code}
            </span>
          </h2>
          {form.is_placeholder && (
            <div className="flex items-center gap-1 text-xs text-amber-700 mt-1">
              <AlertCircle className="w-3 h-3" />
              Placeholder values — please review and save to clear.
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs text-muted-foreground">3-man 5-hr local margin</div>
            <div
              className={`text-sm font-mono font-semibold ${
                margin3x5 >= 45 ? "text-green-700" : margin3x5 >= 35 ? "text-amber-700" : "text-red-700"
              }`}
            >
              {margin3x5.toFixed(1)}%
            </div>
          </div>
          <button
            onClick={save}
            disabled={saving}
            className="px-3 py-1.5 rounded bg-primary text-primary-foreground text-sm disabled:opacity-50 flex items-center gap-1"
          >
            {saving ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Check className="w-3 h-3" />
            )}
            Save
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
        {/* Revenue side — rate card */}
        <div>
          <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
            Rate card (customer-billed)
          </h3>
          <NumField
            label="Base rate: 2 men + 1 truck ($/hr)"
            value={form.rate_base_2man_1truck}
            onChange={(v) => set("rate_base_2man_1truck", v)}
          />
          <NumField
            label="Per extra mover ($/hr)"
            value={form.rate_per_extra_man}
            onChange={(v) => set("rate_per_extra_man", v)}
          />
          <NumField
            label="Per extra truck ($/hr)"
            value={form.rate_per_extra_truck}
            onChange={(v) => set("rate_per_extra_truck", v)}
          />
          <PctField
            label="Sales tax on materials (%)"
            value={form.sales_tax_pct}
            onChange={(v) => set("sales_tax_pct", v)}
          />
        </div>

        {/* Cost side */}
        <div>
          <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
            Cost structure
          </h3>
          <NumField
            label="Burdened per-worker ($/hr)"
            hint="Wage + payroll tax + L&I + liability + PTO accrual. NO truck."
            value={form.burdened_per_worker_hour}
            onChange={(v) => set("burdened_per_worker_hour", v)}
          />
          <NumField
            label="Truck cost ($/hr, local)"
            hint="Fuel + depreciation + insurance + maintenance + permits."
            value={form.truck_cost_per_hour}
            onChange={(v) => set("truck_cost_per_hour", v)}
          />
          <NumField
            label="Deadhead ($/mile, long-haul)"
            hint="Yard → origin empty-truck drive. Fuel + crew wages + wear."
            value={form.deadhead_cost_per_mile}
            onChange={(v) => set("deadhead_cost_per_mile", v)}
          />
          <NumField
            label="Wage average (audit reference)"
            hint="Informational only. The burden above was derived from this wage."
            value={form.wage_average_per_hour}
            onChange={(v) => set("wage_average_per_hour", v)}
          />
        </div>
      </div>

      {/* Long-distance fees */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 px-4 pb-4">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground col-span-full">
          Long-distance defaults
        </h3>
        <PctField
          label="Fuel surcharge (%)"
          value={form.default_fuel_surcharge_pct}
          onChange={(v) => set("default_fuel_surcharge_pct", v)}
        />
        <NumField
          label="Shuttle fee ($)"
          value={form.default_shuttle_fee}
          onChange={(v) => set("default_shuttle_fee", v)}
        />
        <NumField
          label="Long-haul prep ($)"
          value={form.default_long_haul_prep_fee}
          onChange={(v) => set("default_long_haul_prep_fee", v)}
        />
        <NumField
          label="TV crating ($)"
          value={form.default_tv_crating_fee}
          onChange={(v) => set("default_tv_crating_fee", v)}
        />
        <NumField
          label="Specialty item ($)"
          value={form.default_specialty_fee}
          onChange={(v) => set("default_specialty_fee", v)}
        />
      </div>

      {/* Linehaul policy */}
      <div className="px-4 pb-4">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
          Linehaul rate policy
        </h3>
        <div className="flex items-center gap-3 text-sm">
          <select
            className="rounded border px-2 py-1 text-sm"
            value={form.linehaul_rate_mode ?? "midpoint"}
            onChange={(e) => set("linehaul_rate_mode", e.target.value as BranchConfig["linehaul_rate_mode"])}
          >
            <option value="min">Tariff 15-C minimum</option>
            <option value="midpoint">Tariff 15-C midpoint (recommended)</option>
            <option value="max">Tariff 15-C maximum</option>
            <option value="custom">Custom $/lb (override)</option>
          </select>
          {form.linehaul_rate_mode === "custom" && (
            <NumField
              label="Custom rate ($/lb)"
              value={form.linehaul_rate_custom_per_lb}
              onChange={(v) => set("linehaul_rate_custom_per_lb", v)}
              compact
            />
          )}
        </div>
      </div>

      {/* Notes */}
      <div className="px-4 pb-4">
        <label className="text-xs text-muted-foreground">Notes</label>
        <textarea
          className="mt-1 w-full rounded border px-2 py-1 text-sm font-sans"
          rows={2}
          value={form.notes ?? ""}
          onChange={(e) => set("notes", e.target.value || null)}
          placeholder="Audit trail / tuning notes"
        />
      </div>

      {saveMsg && (
        <div
          className={`px-4 pb-3 text-xs ${
            saveMsg.startsWith("Error") ? "text-red-600" : "text-green-700"
          }`}
        >
          {saveMsg}
        </div>
      )}
    </div>
  );
}

function NumField({
  label,
  hint,
  value,
  onChange,
  compact,
}: {
  label: string;
  hint?: string;
  value: number | null;
  onChange: (v: number | null) => void;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "inline-flex items-center gap-2" : "mb-2"}>
      <label className="text-xs text-muted-foreground block">{label}</label>
      <input
        type="number"
        step="any"
        className={`rounded border px-2 py-1 text-sm font-mono ${
          compact ? "w-28" : "w-full"
        }`}
        value={value ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? null : Number(v));
        }}
      />
      {hint && !compact && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

function PctField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  // Store as decimal (0.09), display as percent (9). Floating-point binary
  // rounding would render 0.09 * 100 as "9.000000000000002"; round to two
  // decimals and strip trailing zeros for display.
  const display =
    value !== null && value !== undefined
      ? (Math.round(value * 10000) / 100).toString()
      : "";
  return (
    <div className="mb-2">
      <label className="text-xs text-muted-foreground block">{label}</label>
      <input
        type="number"
        step="any"
        className="rounded border px-2 py-1 text-sm font-mono w-full"
        value={display}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? null : Number(v) / 100);
        }}
      />
    </div>
  );
}
