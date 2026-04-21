"use client";
import { useState, useMemo, useEffect } from "react";
import { Button, ErrorBanner, InlineEditableTable, Input } from "@/components/ui";
import type { InlineEditableColumn } from "@/components/ui";

export interface LineItem {
  label: string;
  kind?: "labor" | "truck" | "material" | "packing" | "travel" | "flat" | "mileage";
  rate?: number;
  quantity?: number;
  unit?: "hour" | "mile" | "cwt" | "flat" | "each" | "day";
  subtotal: number;
  rate_id?: string;
}

export interface LineItemEditorProps {
  estimateId: string;
  /** Seed from estimate.charges_json */
  initialItems: LineItem[];
  /** Pre-existing discount / tax for display + PATCH */
  initialDiscounts?: number;
  initialSalesTax?: number;
  onSaved?: () => void;
  onCancel?: () => void;
}

/**
 * Inline editor for an estimate's charges_json. Built on InlineEditableTable.
 * Recalculates subtotal locally for live preview; the server authoritatively
 * recomputes on PATCH via updateEstimateSchema's recompute logic.
 *
 * Totals shown:
 *   Subtotal   — sum(line_item.subtotal)
 *   Discounts  — editable
 *   Sales tax  — editable
 *   Total      — max(0, subtotal - discounts + sales_tax)
 *
 * On save: PATCH /api/estimates/[id] with { charges_json, discounts, sales_tax }.
 * Server recomputes and returns the canonical estimate. We display its returned
 * `amount` so the user sees the server's rounding rather than our local preview.
 */
export function LineItemEditor({
  estimateId,
  initialItems,
  initialDiscounts = 0,
  initialSalesTax = 0,
  onSaved,
  onCancel,
}: LineItemEditorProps) {
  const [items, setItems] = useState<LineItem[]>(() =>
    initialItems.length > 0 ? initialItems.map(normalize) : [blankItem()],
  );
  const [discounts, setDiscounts] = useState(initialDiscounts);
  const [salesTax, setSalesTax] = useState(initialSalesTax);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subtotal = useMemo(
    () => items.reduce((s, li) => s + (Number(li.subtotal) || 0), 0),
    [items],
  );
  const total = Math.max(0, subtotal - discounts + salesTax);

  // Dirty-state guard (F5 review N2): warn before navigating away with
  // unsaved changes. The parent also collapses the editor on save/cancel —
  // this covers the cross-navigation and tab-close cases.
  const isDirty =
    items.length !== initialItems.length ||
    items.some((li, i) => JSON.stringify(li) !== JSON.stringify(initialItems[i] ?? {})) ||
    discounts !== initialDiscounts ||
    salesTax !== initialSalesTax;

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // Wrap the rows setter so row removal prompts for confirm. Row-deletion is
  // destructive with no undo (F5 review N3); a one-tap confirm is the
  // minimum safeguard.
  function handleRowsChange(next: LineItem[]) {
    if (next.length < items.length) {
      // A row was removed. Require confirmation unless it was a blank row.
      const removed = items.find((li, i) => next[i]?.label !== li.label);
      const isBlank = removed && !removed.label.trim() && (Number(removed.subtotal) || 0) === 0;
      if (!isBlank) {
        const ok = window.confirm("Remove this line item? This can't be undone.");
        if (!ok) return;
      }
    }
    // Auto-compute subtotal = qty × rate (F5 review N1) — only when both are
    // finite and the subtotal is 0/untouched (never clobber a user-entered value).
    const computed = next.map((li, i) => {
      const prev = items[i];
      const qtyChanged = prev?.quantity !== li.quantity;
      const rateChanged = prev?.rate !== li.rate;
      if (!qtyChanged && !rateChanged) return li;
      if (typeof li.quantity === "number" && typeof li.rate === "number" && Number.isFinite(li.quantity) && Number.isFinite(li.rate)) {
        const prevAuto = (prev?.quantity ?? 0) * (prev?.rate ?? 0);
        const subtotalUntouched =
          (prev?.subtotal ?? 0) === 0 ||
          Math.abs((prev?.subtotal ?? 0) - prevAuto) < 0.01;
        if (subtotalUntouched) {
          return { ...li, subtotal: Math.round(li.quantity * li.rate * 100) / 100 };
        }
      }
      return li;
    });
    setItems(computed);
  }

  async function save() {
    setError(null);
    // Validate each line item client-side so we surface the error inline
    // instead of round-tripping through the server for a preventable mistake.
    const invalid = items.findIndex(
      (li) => !li.label.trim() || !Number.isFinite(li.subtotal),
    );
    if (invalid !== -1) {
      setError(`Row ${invalid + 1} needs a description and a valid amount.`);
      return;
    }
    if (items.length === 0) {
      setError("Add at least one line item before saving.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/estimates/${estimateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          charges_json: items.map(normalize),
          discounts,
          sales_tax: salesTax,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error ?? "Failed to save changes");
        return;
      }
      onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const columns: InlineEditableColumn<LineItem>[] = [
    {
      key: "label",
      label: "Description",
      render: (row, _i, onChange) => (
        <Input
          aria-label="Line item description"
          value={row.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="e.g. Movers (per hour)"
          className="w-full"
        />
      ),
    },
    {
      key: "quantity",
      label: "Qty",
      width: "80px",
      align: "right",
      render: (row, _i, onChange) => (
        <Input
          aria-label="Quantity"
          type="number"
          step="0.5"
          value={row.quantity ?? ""}
          onChange={(e) => onChange({ quantity: e.target.value ? Number(e.target.value) : undefined })}
          className="w-full text-right"
        />
      ),
    },
    {
      key: "unit",
      label: "Unit",
      width: "100px",
      render: (row, _i, onChange) => (
        <select
          aria-label="Unit"
          value={row.unit ?? ""}
          onChange={(e) =>
            onChange({ unit: (e.target.value || undefined) as LineItem["unit"] })
          }
          className="text-sm border border-border rounded-md px-2 py-1.5 bg-bg text-text w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          <option value="">—</option>
          <option value="hour">hour</option>
          <option value="mile">mile</option>
          <option value="cwt">100 lbs</option>
          <option value="flat">flat</option>
          <option value="each">each</option>
          <option value="day">day</option>
        </select>
      ),
    },
    {
      key: "rate",
      label: "Rate",
      width: "110px",
      align: "right",
      render: (row, _i, onChange) => (
        <Input
          aria-label="Rate"
          type="number"
          step="0.01"
          value={row.rate ?? ""}
          onChange={(e) => onChange({ rate: e.target.value ? Number(e.target.value) : undefined })}
          className="w-full text-right"
        />
      ),
    },
    {
      key: "subtotal",
      label: "Amount",
      width: "120px",
      align: "right",
      render: (row, _i, onChange) => (
        <Input
          aria-label="Amount"
          type="number"
          step="0.01"
          value={row.subtotal}
          onChange={(e) => onChange({ subtotal: e.target.value ? Number(e.target.value) : 0 })}
          className="w-full text-right"
        />
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <InlineEditableTable<LineItem>
        rows={items}
        onChange={handleRowsChange}
        newRow={blankItem}
        columns={columns}
        addLabel="Add line item"
      />

      {/* Totals strip */}
      <div className="flex justify-end">
        <div className="w-64 space-y-1 text-sm">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span className="font-mono">${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center">
            <label htmlFor="line-discounts" className="text-muted">
              Discounts
            </label>
            <Input
              id="line-discounts"
              type="number"
              step="0.01"
              value={discounts}
              onChange={(e) => setDiscounts(e.target.value ? Number(e.target.value) : 0)}
              className="w-28 text-right"
            />
          </div>
          <div className="flex justify-between items-center">
            <label htmlFor="line-tax" className="text-muted">
              Sales tax
            </label>
            <Input
              id="line-tax"
              type="number"
              step="0.01"
              value={salesTax}
              onChange={(e) => setSalesTax(e.target.value ? Number(e.target.value) : 0)}
              className="w-28 text-right"
            />
          </div>
          <div className="flex justify-between pt-2 border-t border-border font-semibold">
            <span>Total</span>
            <span className="font-mono">${total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {error ? <ErrorBanner message={error} /> : null}

      <div className="flex gap-2">
        <Button onClick={save} loading={saving}>
          Save changes
        </Button>
        {onCancel ? (
          <Button
            variant="secondary"
            onClick={() => {
              if (isDirty && !window.confirm("Discard your changes?")) return;
              onCancel();
            }}
            disabled={saving}
          >
            Cancel
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function blankItem(): LineItem {
  return { label: "", subtotal: 0 };
}

function normalize(li: LineItem): LineItem {
  // Strip undefined so the PATCH body is clean (zod schemas reject extra nulls
  // but the primitive's Inputs produce undefined for empty numerics).
  const out: LineItem = { label: li.label, subtotal: Number(li.subtotal) || 0 };
  if (li.kind) out.kind = li.kind;
  if (li.rate !== undefined && li.rate !== null) out.rate = Number(li.rate);
  if (li.quantity !== undefined && li.quantity !== null) out.quantity = Number(li.quantity);
  if (li.unit) out.unit = li.unit;
  if (li.rate_id) out.rate_id = li.rate_id;
  return out;
}
