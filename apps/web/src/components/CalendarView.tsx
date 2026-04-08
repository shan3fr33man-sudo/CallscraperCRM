"use client";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventDropArg, EventClickArg } from "@fullcalendar/core";
import { EventDetailDrawer, type CalEvent } from "./EventDetailDrawer";

const FullCalendar = dynamic(() => import("@fullcalendar/react"), { ssr: false });

export type CalendarFilters = {
  branch_id?: string;
  owner_id?: string;
  event_type?: string;
};

export function CalendarView({ kind, filters }: { kind: "office" | "job"; filters: CalendarFilters }) {
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<CalEvent | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const qs = useMemo(() => {
    const p = new URLSearchParams({ kind });
    if (filters.branch_id) p.set("branch_id", filters.branch_id);
    if (filters.owner_id) p.set("owner_id", filters.owner_id);
    if (filters.event_type) p.set("event_type", filters.event_type);
    return p.toString();
  }, [kind, filters]);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`/api/calendar-events?${qs}`);
      const j = await r.json();
      setEvents(j.events ?? []);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [qs]);

  async function onDrop(arg: EventDropArg) {
    const id = arg.event.id;
    const startsAt = arg.event.start?.toISOString();
    const endsAt = arg.event.end?.toISOString() ?? startsAt;
    if (!id || !startsAt) return;
    try {
      const r = await fetch(`/api/calendar-events/${id}`, {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ starts_at: startsAt, ends_at: endsAt }),
      });
      if (!r.ok) throw new Error("patch failed");
      setToast("Event rescheduled");
      setTimeout(() => setToast(null), 2500);
    } catch {
      arg.revert();
      setToast("Reschedule failed");
      setTimeout(() => setToast(null), 2500);
    }
  }

  function onClick(arg: EventClickArg) {
    const ev = events.find((e) => e.id === arg.event.id);
    if (ev) setSelected(ev);
  }

  return (
    <div className="relative">
      {loading && <div className="text-xs text-muted-foreground p-2">Loading events…</div>}
      {!loading && events.length === 0 && (
        <div className="border border-dashed border-border rounded-md p-8 text-center text-sm text-muted-foreground">
          No events scheduled.
        </div>
      )}
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay" }}
        editable
        events={events}
        eventDrop={onDrop}
        eventClick={onClick}
        height="auto"
      />
      {selected && <EventDetailDrawer event={selected} onClose={() => setSelected(null)} onChanged={load} />}
      {toast && <div className="fixed bottom-4 right-4 z-50 bg-accent text-white text-xs px-3 py-2 rounded-md shadow-lg">{toast}</div>}
    </div>
  );
}
