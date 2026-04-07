"use client";
import { useState } from "react";
import { AiSidebar } from "./AiSidebar";
import { Sparkles } from "lucide-react";

export function TopBar({ title }: { title: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="h-12 border-b border-border px-5 flex items-center justify-between">
      <div className="text-sm font-medium">{title}</div>
      <button
        onClick={() => setOpen(true)}
        className="text-xs flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-accent/15 text-accent hover:bg-accent/25"
      >
        <Sparkles className="w-3.5 h-3.5" /> Ask Claude
      </button>
      {open && <AiSidebar onClose={() => setOpen(false)} />}
    </div>
  );
}
