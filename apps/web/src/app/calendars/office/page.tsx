"use client";
import { useEffect, useState } from "react";
import { TopBar } from "@/components/TopBar";
import { CalendarView, type CalendarFilters } from "@/components/CalendarView";

const OFFICE_TYPES = [
  { value: "on_site_estimate", label: "On-Site Estimate" },
  { value: "virtual_survey", label: "Virtual Survey" },
  { value: "phone_survey", label: "Phone Survey" },
  { value: "box_delivery", label: "Box Delivery" },
  { value: "liveswitch_survey", label: "LiveSwitch Survey" },
  { value: "other", label: "Other" },
];

type Branch = { id: string; name: string };
type User = { user_id: string; display_name: string };

export default function OfficeCalendarPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [filters, setFilters] = useState<CalendarFilters>({});
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    fetch("/api/branches").then((r) => r.json()).then((j) => setBranches(j.branches ?? []));
    fetch("/api/users").then((r) => r.json()).then((j) => setUsers(j.users ?? []));
  }, []);

  function setF<K extends keyof CalendarFilters>(k: K, v: CalendarFilters[K]) {
    setFilters((prev) => ({ ...prev, [k]: v || undefined }));
  }

  return (
    <div>
      <TopBar title="Office Calendar" />
      <div className="p-5">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <select value={filters.owner_id ?? ""} onChange={(e) => setF("owner_id", e.target.value)} className="text-xs border border-border rounded-md px-2 py-1.5 bg-background">
            <option value="">All users</option>
            {users.map((u) => <option key={u.user_id} value={u.user_id}>{u.display_name}</option>)}
          </select>
          <select value={filters.branch_id ?? ""} onChange={(e) => setF("branch_id", e.target.value)} className="text-xs border border-border rounded-md px-2 py-1.5 bg-background">
            <option value="">All branches</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <div className="flex items-center gap-1 flex-wrap">
            <button onClick={() => setF("event_type", undefined)} className={`text-xs px-2 py-1 rounded-md border ${!filters.event_type ? "bg-accent text-white border-accent" : "border-border"}`}>All types</button>
            {OFFICE_TYPES.map((t) => (
              <button key={t.value} onClick={() => setF("event_type", t.value)} className={`text-xs px-2 py-1 rounded-md border ${filters.event_type === t.value ? "bg-accent text-white border-accent" : "border-border"}`}>{t.label}</button>
            ))}
          </div>
          <button onClick={() => setShowNew(true)} className="ml-auto text-xs px-3 py-1.5 rounded-md bg-accent text-white">+ New Office Event</button>
        </div>
        <CalendarView kind="office" filters={filters} />
        {showNew && <NewOfficeEventModal branches={branches} users={users} onClose={() => setShowNew(false)} />}
      </div>
    </div>
  );
}

function NewOfficeEventModal({ branches, users, onClose }: { branches: Branch[]; users: User[]; onClose: () => void }) {
  const [vals, setVals] = useState<Record<string, string>>({ event_type: "on_site_estimate" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function set(k: string, v: string) { setVals((p) => ({ ...p, [k]: v })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      const start = new Date(vals.starts_at);
      const end = vals.ends_at ? new Date(vals.ends_at) : new Date(start.getTime() + 60 * 60_000);
      const r = await fetch("/api/calendar-events", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "office",
          event_type: vals.event_type,
          title: vals.title,
          starts_at: start.toISOString(),
          ends_at: end.toISOString(),
          location: vals.location || null,
          owner_id: vals.owner_id || null,
          branch_id: vals.branch_id || null,
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "failed");
      onClose();
      window.location.reload();
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-50" onClick={onClose} />
      <div className="fixed top-0 right-0 bottom-0 w-[460px] bg-background border-l border-border z-50 overflow-y-auto">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <div className="text-sm font-semibold">New Office Event</div>
          <button onClick={onClose} className="text-xs text-muted-foreground">Close</button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3 text-sm">
          <div><label className="block text-xs mb-1">Type</label>
            <select className="w-full border border-border rounded-md px-2 py-1.5 text-sm bg-background" value={vals.event_type} onChange={(e) => set("event_type", e.target.value)}>
              {OFFICE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select></div>
          <div><label className="block text-xs mb-1">Title *</label>
            <input required className="w-full border border-border rounded-md px-2 py-1.5 text-sm bg-background" value={vals.title ?? ""} onChange={(e) => set("title", e.target.value)} /></div>
          <div><label className="block text-xs mb-1">Starts *</label>
            <input required type="datetime-local" className="w-full border border-border rounded-md px-2 py-1.5 text-sm bg-background" value={vals.starts_at ?? ""} onChange={(e) => set("starts_at", e.target.value)} /></div>
          <div><label className="block text-xs mb-1">Ends</label>
            <input type="datetime-local" className="w-full border border-border rounded-md px-2 py-1.5 text-sm bg-background" value={vals.ends_at ?? ""} onChange={(e) => set("ends_at", e.target.value)} /></div>
          <div><label className="block text-xs mb-1">Location</label>
            <input className="w-full border border-border rounded-md px-2 py-1.5 text-sm bg-background" value={vals.location ?? ""} onChange={(e) => set("location", e.target.value)} /></div>
          <div><label className="block text-xs mb-1">Owner</label>
            <select className="w-full border border-border rounded-md px-2 py-1.5 text-sm bg-background" value={vals.owner_id ?? ""} onChange={(e) => set("owner_id", e.target.value)}>
              <option value="">—</option>
              {users.map((u) => <option key={u.user_id} value={u.user_id}>{u.display_name}</option>)}
            </select></div>
          <div><label className="block text-xs mb-1">Branch</label>
            <select className="w-full border border-border rounded-md px-2 py-1.5 text-sm bg-background" value={vals.branch_id ?? ""} onChange={(e) => set("branch_id", e.target.value)}>
              <option value="">—</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select></div>
          {err && <div className="text-xs text-red-600">{err}</div>}
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={busy} className="px-3 py-1.5 text-xs rounded-md bg-accent text-white disabled:opacity-50">{busy ? "Saving…" : "Create"}</button>
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs rounded-md border border-border">Cancel</button>
          </div>
        </form>
      </div>
    </>
  );
}
