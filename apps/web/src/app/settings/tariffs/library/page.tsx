"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Archive } from "lucide-react";

type Tariff = {
  id: string;
  name: string;
  branch_id: string | null;
  service_type: string | null;
  effective_from: string | null;
  effective_to: string | null;
  is_default: boolean;
  archived: boolean;
  rate_count: number;
};

type Branch = { id: string; name: string; brand_code: string };

export default function TariffLibraryPage() {
  const router = useRouter();
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [newName, setNewName] = useState("");
  const [newBranch, setNewBranch] = useState("");
  const [newServiceType, setNewServiceType] = useState("local_move");

  async function reload() {
    setLoading(true);
    const [tRes, bRes] = await Promise.all([
      fetch(`/api/tariffs?archived=${showArchived}`).then((r) => r.json()),
      fetch("/api/branches").then((r) => r.json()),
    ]);
    setTariffs(tRes.tariffs ?? []);
    setBranches(bRes.branches ?? []);
    setLoading(false);
  }

  useEffect(() => {
    reload();
  }, [showArchived]);

  async function createTariff() {
    if (!newName.trim()) return;
    const res = await fetch("/api/tariffs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName,
        branch_id: newBranch || null,
        service_type: newServiceType,
      }),
    });
    const j = await res.json();
    if (j.tariff?.id) router.push(`/settings/tariffs/library/${j.tariff.id}`);
    else {
      setShowCreate(false);
      reload();
    }
  }

  function branchName(id: string | null): string {
    if (!id) return "—";
    return branches.find((b) => b.id === id)?.name ?? "Unknown";
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Tariff Library</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pricing rate tables. Each tariff defines base rates, modifiers, valuations, and assignment rules.
          </p>
        </div>
        <div className="flex gap-2">
          <label className="text-xs flex items-center gap-2">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
            Show archived
          </label>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 text-sm bg-accent text-white px-3 py-1.5 rounded-md"
          >
            <Plus className="w-4 h-4" /> New Tariff
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="mb-6 p-4 border border-border rounded-md bg-accent/5">
          <h3 className="text-sm font-semibold mb-3">Create new tariff</h3>
          <div className="grid grid-cols-3 gap-3">
            <input
              autoFocus
              placeholder="Tariff name (e.g. APM Standard 2026)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="text-sm border border-border rounded-md px-3 py-2 bg-background"
            />
            <select
              value={newBranch}
              onChange={(e) => setNewBranch(e.target.value)}
              className="text-sm border border-border rounded-md px-3 py-2 bg-background"
            >
              <option value="">— Any branch —</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.brand_code})
                </option>
              ))}
            </select>
            <select
              value={newServiceType}
              onChange={(e) => setNewServiceType(e.target.value)}
              className="text-sm border border-border rounded-md px-3 py-2 bg-background"
            >
              <option value="local_move">Local Move</option>
              <option value="long_distance">Long Distance</option>
              <option value="commercial">Commercial</option>
              <option value="labor_only">Labor Only</option>
              <option value="packing">Packing</option>
              <option value="storage">Storage</option>
            </select>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={createTariff}
              className="text-sm bg-accent text-white px-4 py-1.5 rounded-md"
            >
              Create &amp; Edit
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="text-sm border border-border px-4 py-1.5 rounded-md"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="border border-border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-accent/5 text-xs">
            <tr>
              <th className="text-left px-3 py-2">Name</th>
              <th className="text-left px-3 py-2">Branch</th>
              <th className="text-left px-3 py-2">Service Type</th>
              <th className="text-left px-3 py-2">Effective</th>
              <th className="text-left px-3 py-2">Rates</th>
              <th className="text-left px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading &&
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} className="border-t border-border">
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} className="px-3 py-2">
                      <div className="h-3 bg-accent/10 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))}
            {!loading && tariffs.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-xs text-muted-foreground py-8">
                  No tariffs yet. Click &quot;New Tariff&quot; to create one.
                </td>
              </tr>
            )}
            {!loading &&
              tariffs.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => router.push(`/settings/tariffs/library/${t.id}`)}
                  className="border-t border-border cursor-pointer hover:bg-accent/5"
                >
                  <td className="px-3 py-2 font-medium">
                    {t.name}
                    {t.is_default && (
                      <span className="ml-2 text-xs bg-accent/10 text-accent px-1.5 py-0.5 rounded">Default</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">{branchName(t.branch_id)}</td>
                  <td className="px-3 py-2 text-xs">{t.service_type ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">
                    {t.effective_from ?? "—"}
                    {t.effective_to ? ` → ${t.effective_to}` : ""}
                  </td>
                  <td className="px-3 py-2 text-xs">{t.rate_count}</td>
                  <td className="px-3 py-2 text-xs">
                    {t.archived ? (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Archive className="w-3 h-3" /> Archived
                      </span>
                    ) : (
                      <span className="text-green-600">Active</span>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
