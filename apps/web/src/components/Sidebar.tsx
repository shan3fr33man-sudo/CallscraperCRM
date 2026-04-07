import Link from "next/link";
import { Phone, Users, Kanban, Sparkles, Settings, PlugZap, Bot, LayoutDashboard } from "lucide-react";

const items = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/calls", label: "Calls", icon: Phone },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/pipeline", label: "Pipeline", icon: Kanban },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/integrations", label: "Integrations", icon: PlugZap },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  return (
    <aside className="w-56 shrink-0 border-r border-border bg-panel min-h-screen flex flex-col">
      <div className="px-5 py-5 border-b border-border">
        <div className="text-sm font-semibold tracking-tight">CallscraperCRM</div>
        <div className="text-[11px] text-muted">v0.1 · open source</div>
      </div>
      <nav className="px-2 py-3 flex-1">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <Link
              key={it.href}
              href={it.href}
              className="flex items-center gap-3 px-3 py-2 text-sm rounded-md text-text hover:bg-white/5"
            >
              <Icon className="w-4 h-4 text-muted" />
              {it.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 text-[11px] text-muted border-t border-border">
        Made for builders who use AI.
      </div>
    </aside>
  );
}
