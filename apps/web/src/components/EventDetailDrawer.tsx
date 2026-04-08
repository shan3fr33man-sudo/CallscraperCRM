"use client";
import { useState } from "react";
import Link from "next/link";

export type CalEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  extendedProps: {
    kind: string;
    event_type: string | null;
    related_type: string | null;
    related_id: string | null;
    branch_id: string | null;
    owner_id: string | null;
    location: string | null;
  };
};

function relatedHref(type: string | null, id: string | null): string | null {
  if (!type || !id) return null;
  if (type === "opportunity") return `/customers/${id}`;
  if (type === "job") return `/dispatch/scheduling`;
  if (type === "task") return `/tasks`;
  if (type === "customer") return `/customers/${id}`;
  return null;
}

export function EventDetailDrawer({ event, onClose, onChanged }: { event: CalEvent; onClose: () => void; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [start, setStart] = useState(event.start.slice(0, 16));
  const [end, setEnd] = useState(event.end.slice(0, 16));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const link = relatedHref(event.extendedProps.related_type, event.extendedProps.related_id);

  async function reschedule() {
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`/api/calendar-events/${event.id}`, {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ starts_at: new Date(start).toISOString(), ends_at: new Date(end).toISOString() }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "failed");
      setEditing(false);
      onChanged();
      onClose();
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  async function cancel() {
    if (!confirm("Cancel this event? This cannot be undone.")) return;
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`/api/calendar-events/${event.id}`, { method: "DELETE" });
      if (!r.ok) throw new Error((await r.json()).error ?? "failed");
      onChanged();
      onClose();
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-50" onClick={onClose} />
      <div className="fixed top-0 right-0 bottom-0 w-[420px] bg-background border-l border-border z-50 overflow-y-auto">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <div className="text-sm font-semibold">Event</div>
          <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">Close</button>
        </div>
        <div className="p-5 space-y-3 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Title</div>
            <div className="font-medium">{event.title}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Type</div>
            <div>{event.extendedProps.event_type ?? "—"} ({event.extendedProps.kind})</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">When</div>
            <div>{new Date(event.start).toLocaleString()} → {new Date(event.end).toLocaleString()}</div>
          </div>
          {event.extendedProps.location && (
            <div>
              <div className="text-xs text-muted-foreground">Location</div>
              <div>{event.extendedProps.location}</div>
            </div>
          )}
          {link && (
            <div>
              <div className="text-xs text-muted-foreground">Related</div>
              <Link href={link} className="text-accent underline">View {event.extendedProps.related_type}</Link>
            </div>
          )}

          {editing ? (
            <div className="border-t border-border pt-3 space-y-2">
              <label className="block text-xs">Starts</label>
              <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className="w-full border border-border rounded-md px-2 py-1.5 text-sm bg-background" />
              <label className="block text-xs">Ends</label>
              <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className="w-full border border-border rounded-md px-2 py-1.5 text-sm bg-background" />
              <div className="flex gap-2">
                <button onClick={reschedule} disabled={busy} className="px-3 py-1.5 text-xs rounded-md bg-accent text-white disabled:opacity-50">Save</button>
                <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-xs rounded-md border border-border">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2 pt-3 border-t border-border">
              <button onClick={() => setEditing(true)} className="px-3 py-1.5 text-xs rounded-md border border-border">Reschedule</button>
              <button onClick={() => setEditing(true)} className="px-3 py-1.5 text-xs rounded-md border border-border">Edit</button>
              <button onClick={cancel} disabled={busy} className="px-3 py-1.5 text-xs rounded-md border border-red-300 text-red-700 disabled:opacity-50">Cancel Event</button>
            </div>
          )}
          {err && <div className="text-xs text-red-600">{err}</div>}
        </div>
      </div>
    </>
  );
}
