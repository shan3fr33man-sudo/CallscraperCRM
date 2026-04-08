"use client";
import { useEffect, useState } from "react";
import { TopBar } from "@/components/TopBar";

type Override = { id: string; kind: string; label: string | null; formula_json: Record<string, unknown> | null; created_at: string };

export default function RateOverridesPage() {
  const [rows, setRows] = useState<Override[]>([]);
  const [showAdd, setShowAdd] = useState(false);

  async function load() {
    try {
      const r = await fetch("/api/rate-overrides");
      const j = await r.json();
      setRows(j.overrides ?? []);
    } catch {}
  }
  useEffect(() => { load(); }, []);

  return (
    <div>
      <TopBar title="Rate Overrides" />
      <div className="p-5 max-w-4xl">
        <div className="border border-border rounded-md p-4 mb-4 bg-accent/5">
          <div className="text-sm font-medium mb-1">What are rate overrides?</div>
          <p className="text-xs text-muted-foreground">Adjust pricing for specific dates — holidays, peak season, or special events. Overrides apply automatically when estimating jobs on affected dates.</p>
        </div>
        <div className="flex justify-between items-center mb-3">
          <div className="text-sm font-medium">Active Overrides</div>
          <button onClick={() => setShowAdd(true)} className="text-xs px-3 py-1.5 rounded-md bg-accent text-white">+ Add Override</button>
        </div>
        {rows.length === 0 ? (
          <div className="border border-dashed border-border rounded-md p-8 text-center text-sm text-muted-foreground">No overrides configured. Add your first one to start adjusting rates for special dates.</div>
        ) : (
          <table className="w-full text-sm border border-border rounded-md">
            <thead className="bg-accent/5 text-xs">
              <tr><th className="text-left px-3 py-2">Label</th><th className="text-left px-3 py-2">Kind</th><th className="text-left px-3 py-2">Multiplier</th><th className="text-left px-3 py-2">Created</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-3 py-2">{r.label ?? "—"}</td>
                  <td className="px-3 py-2">{r.kind}</td>
                  <td className="px-3 py-2">{(r.formula_json as { multiplier?: number })?.multiplier ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {showAdd && <AddOverrideModal onClose={() => { setShowAdd(false); load(); }} />}
      </div>
    </div>
  );
}

function AddOverrideModal({ onClose }: { onClose: () => void }) {
  const [vals, setVals] = useState<Record<string, string>>({ kind: "holiday", multiplier: "1.15" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function set(k: string, v: string) { setVals((p) => ({ ...p, [k]: v })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/rate-overrides", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: vals.kind,
          label: vals.label,
          formula_json: { multiplier: Number(vals.multiplier), start_date: vals.start_date, end_date: vals.end_date },
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "failed");
      onClose();
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-50" onClick={onClose} />
      <div className="fixed top-0 right-0 bottom-0 w-[420px] bg-background border-l border-border z-50 overflow-y-auto">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <div className="text-sm font-semibold">New Rate Override</div>
          <button onClick={onClose} className="text-xs text-muted-foreground">Close</button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3 text-sm">
          <div><label className="block text-xs mb-1">Label *</label>
            <input required className="w-full border border-border rounded-md px-2 py-1.5 text-sm bg-background" value={vals.label ?? ""} onChange={(e) => set("label", e.target.value)} placeholder="e.g. Christmas Week" /></div>
          <div><label className="block text-xs mb-1">Kind</label>
            <select className="w-full border border-border rounded-md px-2 py-1.5 text-sm bg-background" value={vals.kind} onChange={(e) => set("kind", e.target.value)}>
              <option value="holiday">Holiday</option>
              <option value="peak_season">Peak Season</option>
              <option value="weekend">Weekend</option>
              <option value="other">Other</option>
            </select></div>
          <div><label className="block text-xs mb-1">Start date</label>
            <input type="date" className="w-full border border-border rounded-md px-2 py-1.5 text-sm bg-background" value={vals.start_date ?? ""} onChange={(e) => set("start_date", e.target.value)} /></div>
          <div><label className="block text-xs mb-1">End date</label>
            <input type="date" className="w-full border border-border rounded-md px-2 py-1.5 text-sm bg-background" value={vals.end_date ?? ""} onChange={(e) => set("end_date", e.target.value)} /></div>
          <div><label className="block text-xs mb-1">Multiplier</label>
            <input type="number" step="0.01" className="w-full border border-border rounded-md px-2 py-1.5 text-sm bg-background" value={vals.multiplier} onChange={(e) => set("multiplier", e.target.value)} /></div>
          {err && <div className="text-xs text-red-600">{err}</div>}
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={busy} className="px-3 py-1.5 text-xs rounded-md bg-accent text-white disabled:opacity-50">{busy ? "Saving…" : "Create"}</button>
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs rounded-md border border-border">Cancel</button>
          </div>
        </form>
      </div>
    </>
  );
}
