"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";

type Notif = { id: string; body: string; link: string | null; created_at: string; read_at: string | null };
type Data = { notifications: Notif[]; unread: number; overdue_count: number; due_today_count: number };

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Data>({ notifications: [], unread: 0, overdue_count: 0, due_today_count: 0 });

  async function load() {
    try {
      const r = await fetch("/api/notifications");
      if (r.ok) setData(await r.json());
    } catch {}
  }
  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, []);

  async function markAllRead() {
    await fetch("/api/notifications", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ all: true }) });
    load();
  }
  async function markRead(id: string) {
    await fetch("/api/notifications", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
    load();
  }

  return (
    <div className="relative">
      {data.overdue_count > 0 && (
        <Link href="/tasks/overdue" className="text-xs px-2 py-1 rounded-md bg-red-100 text-red-700 mr-2">Overdue Follow-up ({data.overdue_count})</Link>
      )}
      {data.due_today_count > 0 && (
        <Link href="/tasks/due-today" className="text-xs px-2 py-1 rounded-md bg-amber-100 text-amber-700 mr-2">Follow-up Due Today ({data.due_today_count})</Link>
      )}
      <button onClick={() => setOpen((v) => !v)} className="relative p-2 rounded-md hover:bg-accent/10" aria-label="Notifications">
        <Bell className="w-4 h-4" />
        {data.unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-white text-[10px] flex items-center justify-center">{data.unread}</span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 z-50 w-80 bg-background border border-border rounded-md shadow-lg">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border">
              <div className="text-sm font-medium">Notifications</div>
              <button onClick={markAllRead} className="text-xs text-accent hover:underline">Mark all read</button>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {data.notifications.length === 0 && <div className="p-4 text-xs text-muted-foreground">No notifications</div>}
              {data.notifications.map((n) => {
                const Inner = (
                  <div className={`px-3 py-2 border-b border-border hover:bg-accent/5 cursor-pointer ${n.read_at ? "opacity-60" : ""}`} onClick={() => markRead(n.id)}>
                    <div className="text-xs">{n.body}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{new Date(n.created_at).toLocaleString()}</div>
                  </div>
                );
                return n.link ? <Link href={n.link} key={n.id}>{Inner}</Link> : <div key={n.id}>{Inner}</div>;
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
