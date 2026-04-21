"use client";
import { useEffect, useState } from "react";
import { Check, AlertCircle } from "lucide-react";

type Branch = { id: string; name: string };
type SettingItem = { value: string; label: string };
type ResolveResponse = { tariff_id: string | null; tariff_name: string | null };

/**
 * Live "which tariff wins?" preview for the tariff editor page (F6).
 *
 * The user picks a (branch, service_type, opportunity_type) combination;
 * the server runs `resolveTariff()` across every non-archived assignment
 * in the org and returns the winner. The badge indicates one of:
 *   • This tariff wins for this context (green check)
 *   • A different tariff wins (amber, names the other)
 *   • No tariff matches — estimates would fall back to manual pricing (red)
 *
 * Dropdowns read from:
 *   - /api/branches (passed in as prop; parent already loads this)
 *   - /api/settings/estimates → service_types setting
 *   - /api/settings/tariffs → opportunity_types setting
 *
 * A 300 ms debounce on context changes keeps this cheap while the user
 * flips through options.
 */
export function TariffResolverPreview({
  currentTariffId,
  branches,
}: {
  currentTariffId: string;
  branches: Branch[];
}) {
  const [serviceTypes, setServiceTypes] = useState<SettingItem[]>([]);
  const [oppTypes, setOppTypes] = useState<SettingItem[]>([]);
  const [branchId, setBranchId] = useState<string>("");
  const [serviceType, setServiceType] = useState<string>("");
  const [oppType, setOppType] = useState<string>("");
  const [result, setResult] = useState<ResolveResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load dropdown vocabularies once on mount. `no-store` so a user who
  // edits the service-types catalog in another tab and comes back here
  // sees their fresh changes — the Next.js fetch cache would otherwise
  // serve the old list.
  useEffect(() => {
    Promise.all([
      fetch("/api/settings/estimates", { cache: "no-store" }).then((r) => (r.ok ? r.json() : { settings: [] })),
      fetch("/api/settings/tariffs", { cache: "no-store" }).then((r) => (r.ok ? r.json() : { settings: [] })),
    ])
      .then(([e, t]) => {
        const svc = (e.settings ?? []).find((s: { key: string }) => s.key === "service_types");
        const opp = (t.settings ?? []).find((s: { key: string }) => s.key === "opportunity_types");
        setServiceTypes(Array.isArray(svc?.value) ? svc.value : []);
        setOppTypes(Array.isArray(opp?.value) ? opp.value : []);
      })
      .catch(() => {
        // Silent fallback — user sees empty dropdowns rather than a blocking
        // error; the resolver can still run with partial context.
      });
  }, []);

  const hasContext = Boolean(branchId || serviceType || oppType);

  // Debounced resolve. Pack the context into the deps so we don't fire
  // multiple requests while the user flips selects rapidly. Skip the fetch
  // entirely when no context is set — otherwise the default state would be
  // "No tariff matches" (red) before the user has done anything, which
  // reads as an error.
  useEffect(() => {
    if (!hasContext) {
      setResult(null);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const handle = setTimeout(() => {
      setLoading(true);
      setError(null);
      const p = new URLSearchParams();
      if (branchId) p.set("branch_id", branchId);
      if (serviceType) p.set("service_type", serviceType);
      if (oppType) p.set("opportunity_type", oppType);
      fetch(`/api/tariffs/resolve?${p.toString()}`, { cache: "no-store" })
        .then((r) => {
          if (!r.ok) throw new Error(`status ${r.status}`);
          return r.json();
        })
        .then((j: ResolveResponse) => {
          if (!cancelled) setResult(j);
        })
        .catch((e: unknown) => {
          if (!cancelled) setError(e instanceof Error ? e.message : "resolve failed");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [branchId, serviceType, oppType, hasContext]);

  const status: "idle" | "loading" | "error" | "match_this" | "match_other" | "no_match" =
    !hasContext
      ? "idle"
      : loading
        ? "loading"
        : error
          ? "error"
          : result?.tariff_id === currentTariffId
            ? "match_this"
            : result?.tariff_id
              ? "match_other"
              : "no_match";

  return (
    <div className="border border-border rounded-md p-4 bg-panel">
      <div className="text-xs text-muted mb-3">
        Pick a sample context. The engine picks the winning tariff for each
        combination using the assignment rules across every tariff in your
        library.
      </div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        <label className="block">
          <span className="text-[10px] text-muted block mb-1">Branch</span>
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className="w-full text-xs border border-border rounded-md px-2 py-1.5 bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            <option value="">Any branch</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[10px] text-muted block mb-1">Service type</span>
          <select
            value={serviceType}
            onChange={(e) => setServiceType(e.target.value)}
            className="w-full text-xs border border-border rounded-md px-2 py-1.5 bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            <option value="">Any service type</option>
            {serviceTypes.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[10px] text-muted block mb-1">Opportunity type</span>
          <select
            value={oppType}
            onChange={(e) => setOppType(e.target.value)}
            className="w-full text-xs border border-border rounded-md px-2 py-1.5 bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            <option value="">Any opportunity type</option>
            {oppTypes.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Verdict badge. aria-live so screen readers hear resolver changes
          without us explicitly announcing each select change. */}
      <div
        role="status"
        aria-live="polite"
        className={
          status === "match_this"
            ? "inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-green-500/10 text-green-500 border border-green-500/30"
            : status === "match_other"
              ? "inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-amber-500/10 text-amber-500 border border-amber-500/30"
              : status === "no_match"
                ? "inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-red-500/10 text-red-500 border border-red-500/30"
                : "inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-panel text-muted border border-border"
        }
      >
        {status === "idle" ? (
          <span>Pick a branch, service type, or opportunity type above to preview which tariff would apply.</span>
        ) : status === "loading" ? (
          <span>Checking…</span>
        ) : status === "error" ? (
          <>
            <AlertCircle className="w-3 h-3" aria-hidden="true" />
            <span>Couldn&apos;t run the resolver ({error}).</span>
          </>
        ) : status === "match_this" ? (
          <>
            <Check className="w-3 h-3" aria-hidden="true" />
            <span>This tariff wins for this context.</span>
          </>
        ) : status === "match_other" ? (
          <>
            <AlertCircle className="w-3 h-3" aria-hidden="true" />
            <span>
              <strong className="font-semibold">{result?.tariff_name ?? "Another tariff"}</strong>{" "}
              wins instead. Update assignments if this tariff should take priority.
            </span>
          </>
        ) : (
          <>
            <AlertCircle className="w-3 h-3" aria-hidden="true" />
            <span>
              No tariff matches. Estimates in this context fall back to manual pricing.
            </span>
          </>
        )}
      </div>
    </div>
  );
}
