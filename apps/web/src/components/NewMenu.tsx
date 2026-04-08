"use client";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { RecordForm, type FormKind } from "./RecordForm";

const OPTIONS: { kind: FormKind; label: string }[] = [
  { kind: "opportunity", label: "New Opportunity" },
  { kind: "lead", label: "New Lead" },
  { kind: "task", label: "New Task" },
  { kind: "follow_up", label: "New Follow-up" },
];

export function NewMenu() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormKind | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "n" && !e.metaKey && !e.ctrlKey && !e.altKey && (e.target as HTMLElement).tagName !== "INPUT" && (e.target as HTMLElement).tagName !== "TEXTAREA") {
        setOpen(true);
      }
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
          <div className="absolute right-0 top-9 z-50 w-48 bg-background border border-border rounded-md shadow-lg py-1">
            {OPTIONS.map((o) => (
              <button key={o.kind} onClick={() => { setForm(o.kind); setOpen(false); }} className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent/10">{o.label}</button>
            ))}
          </div>
        </>
      )}
      {form && <RecordForm kind={form} onClose={() => setForm(null)} />}
    </div>
  );
}
