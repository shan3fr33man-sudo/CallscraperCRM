"use client";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { RecordForm, type FormKind } from "./RecordForm";

const OPTIONS: { kind: FormKind; label: string; shortcut?: string }[] = [
  { kind: "opportunity", label: "New Opportunity", shortcut: "O" },
  { kind: "lead", label: "New Lead" },
  { kind: "customer", label: "New Customer", shortcut: "C" },
  { kind: "task", label: "New Task", shortcut: "T" },
  { kind: "follow_up", label: "New Follow-up" },
  { kind: "estimate", label: "New Estimate", shortcut: "E" },
  { kind: "ticket", label: "New Ticket" },
];

export function NewMenu() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormKind | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "n" || e.key === "N") { setOpen(true); e.preventDefault(); }
      else if (e.key === "o" || e.key === "O") { setForm("opportunity"); e.preventDefault(); }
      else if (e.key === "c" || e.key === "C") { setForm("customer"); e.preventDefault(); }
      else if (e.key === "t" || e.key === "T") { setForm("task"); e.preventDefault(); }
      else if (e.key === "e" || e.key === "E") { setForm("estimate"); e.preventDefault(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md bg-accent text-white hover:opacity-90">
        <Plus className="w-3.5 h-3.5" /> New
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-9 z-50 w-56 bg-background border border-border rounded-md shadow-lg py-1">
            {OPTIONS.map((o) => (
              <button key={o.kind} onClick={() => { setForm(o.kind); setOpen(false); }} className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent/10 flex items-center justify-between">
                <span>{o.label}</span>
                {o.shortcut && <span className="text-[10px] text-muted-foreground border border-border rounded px-1">{o.shortcut}</span>}
              </button>
            ))}
          </div>
        </>
      )}
      {form && <RecordForm kind={form} onClose={() => setForm(null)} />}
    </div>
  );
}
