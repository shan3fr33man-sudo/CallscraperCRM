import { TopBar } from "@/components/TopBar";
import Link from "next/link";
import { Database, Bot, Key } from "lucide-react";

const tiles = [
  { href: "/settings/objects", label: "Custom Objects", desc: "Build your own data models", icon: Database },
  { href: "/agents",           label: "Agents",         desc: "Manage AI agents and view runs", icon: Bot },
  { href: "/integrations",     label: "Integrations",   desc: "Plugins and data sources",      icon: Key },
];

export default function SettingsPage() {
  return (
    <>
      <TopBar title="Settings" />
      <div className="p-6 max-w-4xl">
        <div className="grid grid-cols-2 gap-4">
          {tiles.map((t) => {
            const Icon = t.icon;
            return (
              <Link
                key={t.href}
                href={t.href}
                className="rounded-lg border border-border bg-panel p-4 hover:bg-white/5"
              >
                <Icon className="w-5 h-5 text-accent" />
                <div className="text-sm font-medium mt-2">{t.label}</div>
                <div className="text-xs text-muted mt-0.5">{t.desc}</div>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
