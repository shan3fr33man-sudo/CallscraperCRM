"use client";
import { useId, useState } from "react";
import { Minus, Plus, X, Check, Loader2 } from "lucide-react";

export type Truck = { id: string; name: string; capacity: number | null };

/**
 * Inline crew + truck picker for the dispatch command center. Expands
 * below the job row and lets a dispatcher set crew_size and truck_ids
 * without leaving the board.
 *
 * Writes go through PATCH /api/jobs/[id], whose field whitelist (Module 5)
 * allows only the approved columns — org_id and other cross-tenant fields
 * will be silently dropped server-side even if a caller forges them.
 *
 * State-reset strategy: the parent passes `key={job.id}` so React unmounts
 * and remounts this component on job change, giving a clean state reset
 * without a prop-watching useEffect. (The previous useEffect-based reset
 * wiped in-progress edits whenever the parent re-rendered because
 * `initialTruckIds` was a fresh array identity each render.)
 */
export function CrewPicker({
  jobId,
  initialCrewSize,
  initialTruckIds,
  trucks,
  onSaved,
  onClose,
}: {
  jobId: string;
  initialCrewSize: number;
  initialTruckIds: string[];
  trucks: Truck[];
  onSaved: () => void;
  onClose: () => void;
}) {
  const crewId = useId();
  // Empty-string crewSizeStr lets the stepper show "" while the user clears
  // the field mid-edit. The numeric crewSize stays in sync for save.
  const [crewSize, setCrewSize] = useState<number>(initialCrewSize);
  const [crewSizeStr, setCrewSizeStr] = useState<string>(String(initialCrewSize));
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialTruckIds));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleTruck(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function setCrewFromInput(raw: string) {
    setCrewSizeStr(raw);
    // Allow empty string mid-edit; finalize to 0 when saving. Reject NaN by
    // only updating the numeric state when parsing produces a finite number.
    const n = raw === "" ? 0 : Number(raw);
    if (Number.isFinite(n)) setCrewSize(n);
  }

  async function save() {
    setError(null);
    if (crewSize < 0 || crewSize > 20 || !Number.isFinite(crewSize)) {
      setError("Crew size must be between 0 and 20");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          crew_size: crewSize,
          truck_ids: Array.from(selected),
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error ?? "Failed to save");
        return;
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="px-4 py-3 bg-panel border-l-2 border-accent flex flex-wrap items-center gap-4 text-xs"
      role="region"
      aria-label={`Assign crew for job ${jobId.slice(0, 8)}`}
    >
      {/* Crew size stepper */}
      <div className="flex items-center gap-2">
        <label htmlFor={crewId} className="text-muted">
          Crew size
        </label>
        <div className="inline-flex items-center border border-border rounded-md overflow-hidden">
          <button
            type="button"
            onClick={() => {
              const next = Math.max(0, crewSize - 1);
              setCrewSize(next);
              setCrewSizeStr(String(next));
            }}
            aria-label="Decrease crew size"
            className="px-2 py-1 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            <Minus className="w-3 h-3" aria-hidden="true" />
          </button>
          <input
            id={crewId}
            type="number"
            min={0}
            max={20}
            value={crewSizeStr}
            onChange={(e) => setCrewFromInput(e.target.value)}
            onBlur={() => {
              // Normalize empty → 0 when the user leaves the field so the
              // save payload is always a clean integer.
              if (crewSizeStr === "") setCrewSizeStr("0");
            }}
            className="w-12 text-center bg-panel text-text border-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          />
          <button
            type="button"
            onClick={() => {
              const next = Math.min(20, crewSize + 1);
              setCrewSize(next);
              setCrewSizeStr(String(next));
            }}
            aria-label="Increase crew size"
            className="px-2 py-1 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            <Plus className="w-3 h-3" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Truck multiselect */}
      <fieldset className="flex items-center gap-2 flex-wrap">
        <legend className="sr-only">Assign trucks</legend>
        <span className="text-muted" aria-hidden="true">
          Trucks
        </span>
        {trucks.length === 0 ? (
          <span className="text-muted italic">
            No trucks configured.{" "}
            <a
              href="/settings/dispatch/fleet"
              className="underline underline-offset-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              Configure fleet
            </a>
          </span>
        ) : (
          trucks.map((t) => {
            const checked = selected.has(t.id);
            return (
              <label
                key={t.id}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border cursor-pointer focus-within:ring-2 focus-within:ring-accent/60 ${
                  checked ? "bg-accent text-white border-accent" : "border-border hover:bg-accent/5"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleTruck(t.id)}
                  className="sr-only"
                />
                {checked ? <Check className="w-3 h-3" aria-hidden="true" /> : null}
                {t.name}
              </label>
            );
          })
        )}
      </fieldset>

      {error ? (
        <span role="alert" className="text-red-500">
          {error}
        </span>
      ) : null}

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          aria-busy={saving || undefined}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-accent text-white hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" /> : <Check className="w-3 h-3" aria-hidden="true" />}
          {saving ? "Saving\u2026" : "Save"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-border hover:bg-accent/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          aria-label="Close crew picker"
        >
          <X className="w-3 h-3" aria-hidden="true" />
          Close
        </button>
      </div>
    </div>
  );
}
