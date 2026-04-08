"use client";
import { useEffect, useState } from "react";

type Opp = Record<string, unknown> & { id: string };
type Activity = { id: string; kind: string | null; body: string | null; created_at: string };

export function OpportunityDrawer({ opp, onClose }: { opp: Opp; onClose: () => void }) {
  const [tab, setTab] = useState<"all" | "note" | "email" | "call" | "text">("all");
  const [activities, setActivities] = useState<Activity[]>([]);
  const [note, setNote] = useState("");

  async function load() {
    const r = await fetch(`/api/activities?related_type=opportunity&related_id=${opp.id}`);
    const j = await r.json();
    setActivities(j.activities ?? []);
  }
  useEffect(() => { load(); }, [opp.id]);

  async function addNote() {
    if (!note.trim()) return;
    await fetch("/api/activities", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "note", body: note, related_type: "opportunity", related_id: opp.id, customer_id: opp.customer_id }) });
    setNote("");
    load();
  }

  const filtered = tab === "all" ? activities : activities.filter((a) => a.kind === tab);

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-50" onClick={onClose} />
      <div className="fixed top-0 right-0 bottom-0 w-[540px] bg-background border-l border-border z-50 overflow-y-auto">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <div className="text-sm font-semibold">Opportunity</div>
          <button onClick={onClose} className="text-xs text-muted-foreground">Close</button>
        </div>
        <div className="p-5 space-y-3 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Customer</div>
            <div className="font-medium">{String(opp.customer_name ?? "—")}</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><div className="text-xs text-muted-foreground">Status</div><div>{String(opp.status ?? "—")}</div></div>
            <div><div className="text-xs text-muted-foreground">Service date</div><div>{String(opp.service_date ?? "—")}</div></div>
            <div><div className="text-xs text-muted-foreground">Move size</div><div>{String(opp.move_size ?? "—")}</div></div>
            <div><div className="text-xs text-muted-foreground">Source</div><div>{String(opp.source ?? "—")}</div></div>
            <div><div className="text-xs text-muted-foreground">Amount</div><div>${String(opp.amount ?? 0)}</div></div>
            <div><div className="text-xs text-muted-foreground">Lead quality</div><div>{String(opp.lead_quality ?? "—")}</div></div>
          </div>

          <div className="border-t border-border pt-3">
            <div className="text-xs font-medium mb-2">Activity</div>
            <div className="flex gap-1 mb-2">
              {(["all", "note", "email", "call", "text"] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)} className={`text-xs px-2 py-1 rounded-md border ${tab === t ? "bg-accent text-white border-accent" : "border-border"}`}>{t}</button>
              ))}
            </div>
            <div className="flex gap-2 mb-3">
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note…" className="flex-1 text-xs border border-border rounded-md px-2 py-1.5 bg-background" />
              <button onClick={addNote} className="text-xs px-2 py-1.5 rounded-md bg-accent text-white">Add</button>
            </div>
            <div className="space-y-2">
              {filtered.length === 0 && <div className="text-xs text-muted-foreground">No activity yet.</div>}
              {filtered.map((a) => (
                <div key={a.id} className="border border-border rounded-md px-2 py-1.5">
                  <div className="text-[10px] text-muted-foreground">{a.kind} · {new Date(a.created_at).toLocaleString()}</div>
                  <div className="text-xs">{a.body}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
