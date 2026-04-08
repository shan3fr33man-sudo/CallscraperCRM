"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Icons from "lucide-react";
import { NAV } from "@/lib/nav";

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-60 shrink-0 border-r border-border bg-panel min-h-screen flex flex-col">
      <div className="px-5 py-5 border-b border-border">
        <div className="text-sm font-semibold tracking-tight">CallscraperCRM</div>
        <div className="text-[11px] text-muted">v0.5 · open source</div>
      </div>
      <nav className="px-2 py-3 flex-1 overflow-y-auto">
        {NAV.map((section) => {
          const Icon = ((Icons as unknown) as Record<string, React.ComponentType<{ className?: string }>>)[section.icon] ?? Icons.Square;
          const href = `/${section.slug}`;
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={section.slug}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 text-sm rounded-md ${active ? "bg-white/10 text-white" : "text-text hover:bg-white/5"}`}
            >
              <Icon className="w-4 h-4 text-muted" />
              {section.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 text-[11px] text-muted border-t border-border">
        Built with Supabase + Claude.
      </div>
    </aside>
  );
}
