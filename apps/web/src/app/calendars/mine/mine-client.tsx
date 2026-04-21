"use client";
import { useState } from "react";
import { CalendarClock } from "lucide-react";
import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { CalendarView, type CalendarFilters } from "@/components/CalendarView";
import { EmptyState } from "@/components/ui";

/** Anchor styled to match <Button variant="secondary">. Avoids the
 *  <a><button> nesting trap that would break if we wrapped <Button> in <Link>. */
const SECONDARY_ANCHOR =
  "inline-flex items-center justify-center rounded-md font-medium text-sm px-3 py-1.5 " +
  "border border-border bg-panel text-text hover:bg-accent/5 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60";

const PRIMARY_ANCHOR =
  "inline-flex items-center justify-center rounded-md font-medium text-sm px-3 py-1.5 " +
  "bg-accent text-white hover:bg-accent/90 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60";

const OFFICE_TYPES = [
  { value: "on_site_estimate", label: "On-Site Estimate" },
  { value: "virtual_survey", label: "Virtual Survey" },
  { value: "phone_survey", label: "Phone Survey" },
  { value: "box_delivery", label: "Box Delivery" },
  { value: "liveswitch_survey", label: "LiveSwitch Survey" },
  { value: "other", label: "Other" },
];

/**
 * Client half of /calendars/mine. Scopes the calendar query to the
 * signed-in user via owner_id — the user filter is intentionally omitted
 * from the UI because this page IS the filter.
 *
 * When `userId` is null (unauthenticated / DEFAULT_ORG mode) we show a
 * helpful empty-state explaining why the calendar is blank rather than
 * silently returning zero results.
 */
export function MineCalendarClient({ userId }: { userId: string | null }) {
  const [eventType, setEventType] = useState<string | undefined>();

  // When there's no signed-in user, render a signed-out EmptyState INSTEAD of
  // querying the calendar. Dropping owner_id from the filter would otherwise
  // return every user's office events in the default org — which contradicts
  // the "your calendar only populates when signed in" copy.
  if (!userId) {
    return (
      <div>
        <TopBar title="My Calendar" />
        <div className="p-5">
          <EmptyState
            icon={<CalendarClock className="w-8 h-8 opacity-60" aria-hidden="true" />}
            title="Sign in to see your calendar"
            description="Your personal office calendar only populates when you're signed in."
            action={
              <Link href="/login" className={PRIMARY_ANCHOR}>
                Sign in
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  const filters: CalendarFilters = { owner_id: userId, event_type: eventType };

  return (
    <div>
      <TopBar title="My Calendar" />
      <div className="p-5">
        <div className="flex items-center gap-1 flex-wrap mb-4" role="group" aria-label="Filter by event type">
          <button
            type="button"
            onClick={() => setEventType(undefined)}
            aria-pressed={!eventType}
            className={`text-xs px-2 py-1 rounded-md border ${
              !eventType ? "bg-accent text-white border-accent" : "border-border"
            }`}
          >
            All types
          </button>
          {OFFICE_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setEventType(t.value)}
              aria-pressed={eventType === t.value}
              className={`text-xs px-2 py-1 rounded-md border ${
                eventType === t.value ? "bg-accent text-white border-accent" : "border-border"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <CalendarView
          kind="office"
          filters={filters}
          emptyState={
            <EmptyState
              icon={<CalendarClock className="w-8 h-8 opacity-60" aria-hidden="true" />}
              title="Nothing on your calendar yet"
              description="When you schedule a survey, book a follow-up, or an estimate gets signed, it appears here."
              action={
                <Link href="/tasks/open" className={SECONDARY_ANCHOR}>
                  Open tasks
                </Link>
              }
            />
          }
        />
      </div>
    </div>
  );
}
