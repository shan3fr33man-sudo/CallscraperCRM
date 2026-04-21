"use client";
import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { CalendarView, type CalendarFilters } from "@/components/CalendarView";
import { EmptyState } from "@/components/ui";

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

/**
 * /calendars/team — whole-team office calendar.
 *
 * Shows every user's office-style events (surveys, follow-ups, box deliveries,
 * LiveSwitch sessions). Managers filter by user/branch to drill into a specific
 * person or branch; reps use this to see where the whole team's time is going.
 *
 * Compared to /calendars/mine (personal view), this page defaults to the
 * ALL-USERS view and surfaces the user filter prominently.
 */
export default function TeamCalendarPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [filters, setFilters] = useState<CalendarFilters>({});
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/branches").then((r) => (r.ok ? r.json() : { branches: [] })),
      fetch("/api/users").then((r) => (r.ok ? r.json() : { users: [] })),
    ])
      .then(([b, u]) => {
        setBranches(b.branches ?? []);
        setUsers(u.users ?? []);
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : "Failed to load filters"));
  }, []);

  function setF<K extends keyof CalendarFilters>(k: K, v: CalendarFilters[K]) {
    setFilters((prev) => ({ ...prev, [k]: v || undefined }));
  }

  return (
    <div>
      <TopBar title="Team Calendar" />
      <div className="p-5">
        {loadError && (
          <div className="text-xs text-red-600 mb-3" role="alert">
            Couldn&apos;t load filter options: {loadError}
          </div>
        )}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <select
            aria-label="Filter by user"
            value={filters.owner_id ?? ""}
            onChange={(e) => setF("owner_id", e.target.value)}
            className="text-xs border border-border rounded-md px-2 py-1.5 bg-panel"
          >
            <option value="">All users</option>
            {users.map((u) => (
              <option key={u.user_id} value={u.user_id}>
                {u.display_name}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by branch"
            value={filters.branch_id ?? ""}
            onChange={(e) => setF("branch_id", e.target.value)}
            className="text-xs border border-border rounded-md px-2 py-1.5 bg-panel"
          >
            <option value="">All branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-1 flex-wrap" role="group" aria-label="Filter by event type">
            <button
              type="button"
              onClick={() => setF("event_type", undefined)}
              aria-pressed={!filters.event_type}
              className={`text-xs px-2 py-1 rounded-md border ${
                !filters.event_type ? "bg-accent text-white border-accent" : "border-border"
              }`}
            >
              All types
            </button>
            {OFFICE_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setF("event_type", t.value)}
                aria-pressed={filters.event_type === t.value}
                className={`text-xs px-2 py-1 rounded-md border ${
                  filters.event_type === t.value ? "bg-accent text-white border-accent" : "border-border"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <CalendarView
          kind="office"
          filters={filters}
          emptyState={
            <EmptyState
              icon={<Users className="w-8 h-8 opacity-60" aria-hidden="true" />}
              title="No events on the team calendar"
              description="Surveys, follow-ups, box deliveries, and LiveSwitch sessions appear here as your team schedules them. Loosen the filters above or check back once events are booked."
            />
          }
        />
      </div>
    </div>
  );
}
