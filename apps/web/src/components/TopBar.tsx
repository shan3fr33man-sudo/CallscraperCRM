"use client";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";
import { AiSidebar } from "./AiSidebar";
import { GlobalSearch } from "./GlobalSearch";
import { NewMenu } from "./NewMenu";
import { NotificationsBell } from "./NotificationsBell";
import { UserMenu } from "./UserMenu";
import { NAV } from "@/lib/nav";

function breadcrumb(pathname: string): string {
  if (!pathname || pathname === "/") return "Home";
  const parts = pathname.split("/").filter(Boolean);
  const sectionSlug = parts[0];
  const section = NAV.find((s) => s.slug === sectionSlug);
  if (!section) return parts.map((p) => p.replace(/-/g, " ")).join(" / ");
  const sub = parts[1] ? section.subtabs.find((s) => s.slug === parts[1]) : null;
  return [section.label, sub?.label].filter(Boolean).join(" / ");
}

export function TopBar({ title }: { title?: string }) {
  const pathname = usePathname();
  const [aiOpen, setAiOpen] = useState(false);
  const crumb = title ?? breadcrumb(pathname ?? "/");

  return (
    <div className="h-12 border-b border-border px-4 flex items-center gap-3">
      <div className="text-sm font-medium min-w-0 flex-shrink-0">{crumb}</div>
      <div className="flex-1 flex justify-center"><GlobalSearch /></div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <NewMenu />
        <NotificationsBell />
        <button onClick={() => setAiOpen(true)} className="text-xs flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-accent/15 text-accent hover:bg-accent/25">
          <Sparkles className="w-3.5 h-3.5" /> Ask Claude
        </button>
        <UserMenu />
      </div>
      {aiOpen && <AiSidebar onClose={() => setAiOpen(false)} />}
    </div>
  );
}
