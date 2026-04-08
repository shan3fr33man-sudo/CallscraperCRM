import Link from "next/link";
import type { Section, SubTab } from "@/lib/nav";

export function SubNav({ section, activeSub, activeChild }: { section: Section; activeSub?: string; activeChild?: string }) {
  const sub = section.subtabs.find((s) => s.slug === activeSub);
  return (
    <div className="border-b border-border bg-panel">
      <div className="px-6 pt-5">
        <h1 className="text-xl font-semibold">{section.label}</h1>
      </div>
      <div className="px-6 mt-3 flex flex-wrap gap-1">
        {section.subtabs.map((s) => {
          const href = `/${section.slug}/${s.slug}`;
          const active = s.slug === activeSub;
          return (
            <Link
              key={s.slug}
              href={href}
              className={`px-3 py-2 text-sm rounded-t-md border-b-2 ${active ? "border-accent text-white" : "border-transparent text-muted hover:text-white"}`}
            >
              {s.label}
            </Link>
          );
        })}
      </div>
      {sub?.children && sub.children.length > 0 && (
        <div className="px-6 py-2 flex flex-wrap gap-2 bg-bg/40 border-t border-border">
          {sub.children.map((c: SubTab) => {
            const href = `/${section.slug}/${sub.slug}/${c.slug}`;
            const active = c.slug === activeChild;
            return (
              <Link
                key={c.slug}
                href={href}
                className={`px-3 py-1 text-xs rounded-full border ${active ? "border-accent text-white bg-accent/20" : "border-border text-muted hover:text-white"}`}
              >
                {c.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
