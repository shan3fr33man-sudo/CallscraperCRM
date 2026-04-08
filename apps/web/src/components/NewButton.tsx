"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { RecordForm, type FormKind } from "./RecordForm";

export function NewButton({ kind, label, prefill }: { kind: FormKind; label?: string; prefill?: Record<string, string> }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md bg-accent text-white hover:opacity-90">
        <Plus className="w-3.5 h-3.5" /> {label ?? "New"}
      </button>
      {open && <RecordForm kind={kind} onClose={() => setOpen(false)} prefill={prefill} />}
    </>
  );
}
