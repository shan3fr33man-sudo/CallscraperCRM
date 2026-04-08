import { notFound, redirect } from "next/navigation";
import { NAV, findSection } from "@/lib/nav";
import { SubNav } from "@/components/SubNav";

export function generateStaticParams() {
  const params: { section: string; rest?: string[] }[] = [];
  for (const s of NAV) {
    params.push({ section: s.slug });
    for (const sub of s.subtabs) {
      params.push({ section: s.slug, rest: [sub.slug] });
      if (sub.children) {
        for (const c of sub.children) {
          params.push({ section: s.slug, rest: [sub.slug, c.slug] });
        }
      }
    }
  }
  return params;
}

export default async function Page({ params }: { params: Promise<{ section: string; rest?: string[] }> }) {
  const { section: sectionSlug, rest } = await params;
  const section = findSection(sectionSlug);
  if (!section) notFound();

  // /section -> redirect to first sub
  if (!rest || rest.length === 0) {
    redirect(`/${section.slug}/${section.subtabs[0].slug}`);
  }

  const [subSlug, childSlug] = rest;
  const sub = section.subtabs.find((s) => s.slug === subSlug);
  if (!sub) notFound();

  // /section/sub with children -> redirect to first child
  if (sub.children && sub.children.length > 0 && !childSlug) {
    redirect(`/${section.slug}/${sub.slug}/${sub.children[0].slug}`);
  }

  const child = sub.children?.find((c) => c.slug === childSlug);
  const title = child?.label ?? sub.label;

  return (
    <div className="flex-1">
      <SubNav section={section} activeSub={sub.slug} activeChild={child?.slug} />
      <div className="p-6">
        <div className="rounded-lg border border-border bg-panel p-8">
          <div className="text-xs uppercase tracking-wider text-muted mb-2">
            {section.label} {sub ? `/ ${sub.label}` : ""} {child ? `/ ${child.label}` : ""}
          </div>
          <h2 className="text-2xl font-semibold mb-2">{title}</h2>
          <p className="text-muted text-sm max-w-2xl">
            This page is scaffolded from the CallscraperCRM navigation. Data will be wired
            to Supabase per object — once you point this section at a custom object, all
            records, filters, and views will render here automatically.
          </p>
        </div>
      </div>
    </div>
  );
}
