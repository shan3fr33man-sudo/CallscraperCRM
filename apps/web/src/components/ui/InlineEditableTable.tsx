"use client";
import { useState, useCallback, type ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "./Button";

export interface InlineEditableColumn<T> {
  /** Unique key for React reconciliation + header label lookup */
  key: keyof T & string;
  /** Column header text */
  label: string;
  /** Optional fixed width for this column */
  width?: string;
  /** Right-align numeric cells */
  align?: "left" | "right" | "center";
  /** Render the cell as editable input, select, checkbox, or read-only text.
   *  Defaults to a plain text input bound to row[key] as a string. */
  render?: (
    row: T,
    rowIndex: number,
    onChange: (next: Partial<T>) => void,
  ) => ReactNode;
}

export interface InlineEditableTableProps<T> {
  rows: T[];
  columns: InlineEditableColumn<T>[];
  /** Called whenever a cell is edited, a row is added, or a row is removed.
   *  Parent is the source of truth — store `rows` in its own state. */
  onChange: (rows: T[]) => void;
  /** Template for a newly-added blank row. */
  newRow: () => T;
  /** Render a footer row (totals, add button in a custom position, etc.) */
  footer?: ReactNode;
  /** Text for the Add button. Defaults to "Add row". */
  addLabel?: string;
  /** Disable add/remove and mark inputs readOnly. Useful for preview modes. */
  readOnly?: boolean;
  /** Empty-state text shown when `rows.length === 0` */
  emptyMessage?: string;
}

/**
 * Inline-editable table primitive. Renders `rows` with a header row and
 * optional add/delete controls. Each column's `render` callback is
 * responsible for drawing its editor and calling `onChange({field: value})`
 * to produce the updated row — the primitive handles row-level immutable
 * splicing.
 *
 * Parent owns the `rows` state; this primitive is stateless on the data side.
 * Use this for line-item editors (estimates, invoices) where users add/remove
 * charges inline. The 5-line call site lets pages stay focused on their
 * domain logic.
 *
 * Example:
 *   <InlineEditableTable<LineItem>
 *     rows={items}
 *     onChange={setItems}
 *     newRow={() => ({ label: "", subtotal: 0 })}
 *     columns={[
 *       { key: "label", label: "Description", render: (r, i, on) => (
 *         <Input value={r.label} onChange={e => on({ label: e.target.value })} />
 *       ) },
 *       { key: "subtotal", label: "Amount", align: "right", render: (r, i, on) => (
 *         <Input type="number" value={r.subtotal} onChange={e => on({ subtotal: +e.target.value })} />
 *       ) },
 *     ]}
 *     footer={<tr><td>Total</td><td>${total}</td></tr>}
 *   />
 */
export function InlineEditableTable<T>({
  rows,
  columns,
  onChange,
  newRow,
  footer,
  addLabel = "Add row",
  readOnly = false,
  emptyMessage = "No rows. Click Add to create one.",
}: InlineEditableTableProps<T>) {
  const [focusedRow, setFocusedRow] = useState<number | null>(null);

  const updateRow = useCallback(
    (rowIndex: number, partial: Partial<T>) => {
      const next = rows.slice();
      next[rowIndex] = { ...next[rowIndex], ...partial };
      onChange(next);
    },
    [rows, onChange],
  );

  const removeRow = useCallback(
    (rowIndex: number) => {
      onChange(rows.filter((_, i) => i !== rowIndex));
    },
    [rows, onChange],
  );

  const addRow = useCallback(() => {
    onChange([...rows, newRow()]);
  }, [rows, newRow, onChange]);

  return (
    <div>
      <div className="border border-border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-accent/5 text-xs">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={`px-3 py-2 text-${c.align ?? "left"}`}
                  style={c.width ? { width: c.width } : undefined}
                >
                  {c.label}
                </th>
              ))}
              {!readOnly ? <th className="w-10"></th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (readOnly ? 0 : 1)}
                  className="px-3 py-4 text-center text-xs text-muted"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr
                  key={i}
                  className={`border-t border-border ${focusedRow === i ? "bg-accent/5" : ""}`}
                  // Focus bubbles from the row's descendant inputs. We use
                  // focusin/focusout with relatedTarget checks so that moving
                  // focus BETWEEN cells in the same row doesn't flicker the
                  // highlight off and back on.
                  onFocus={() => setFocusedRow(i)}
                  onBlur={(e) => {
                    // currentTarget is the tr; relatedTarget is the element
                    // receiving focus. If it's still inside this tr, don't
                    // clear the highlight.
                    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                      setFocusedRow((current) => (current === i ? null : current));
                    }
                  }}
                >
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={`px-2 py-1.5 text-${c.align ?? "left"} align-middle`}
                    >
                      {c.render
                        ? c.render(row, i, (partial) => updateRow(i, partial))
                        : String(row[c.key] ?? "")}
                    </td>
                  ))}
                  {!readOnly ? (
                    <td className="px-2 py-1.5 align-middle">
                      <button
                        onClick={() => removeRow(i)}
                        aria-label="Remove row"
                        className="text-muted hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
            {footer}
          </tbody>
        </table>
      </div>
      {!readOnly ? (
        <Button
          variant="secondary"
          size="sm"
          icon={<Plus className="w-3 h-3" />}
          onClick={addRow}
          className="mt-2"
        >
          {addLabel}
        </Button>
      ) : null}
    </div>
  );
}
