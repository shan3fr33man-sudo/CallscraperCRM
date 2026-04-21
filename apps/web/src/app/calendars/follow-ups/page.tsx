"use client";
import { CheckCheck } from "lucide-react";
import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { CalendarView, type CalendarFilters } from "@/components/CalendarView";
import { EmptyState } from "@/components/ui";

/** Anchor styled to match <Button variant="secondary">. Avoids the invalid
 *  <a><button> nesting HTML that would result from wrapping <Button> in <Link>. */
const SECONDARY_ANCHOR =
  "inline-flex items-center justify-center rounded-md font-medium text-sm px-3 py-1.5 " +
  "border border-border bg-panel text-text hover:bg-accent/5 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60";

/**
 * /calendars/follow-ups — calendar view of task-linked office events.
 *
 * The "+ New Follow-up" flow creates both a `tasks` row AND a paired
 * `calendar_events` row (kind='office', event_type='other', related_type='task').
 * This calendar scopes to those paired events so users see their scheduled
 * follow-up commitments on a time grid.
 *
 * Raw tasks with a `due_at` but no paired calendar event are intentionally
 * NOT shown here — they live in `/tasks/open`. The empty-state CTA points
 * users there so nothing is hidden.
 *
 * No assignee filter on this page yet: follow-ups don't carry an explicit
 * assignee through the form (TASK_FIELDS has no assigned_to), so any UI
 * dropdown would silently match nothing. Once the follow-up form gains an
 * assignee picker, /calendars/mine already filters by current user via
 * owner_id (RecordForm now mirrors task.assigned_to → event.owner_id), and
 * a Branch filter can be added back here.
 */
export default function FollowUpsCalendarPage() {
  const filters: CalendarFilters = {
    event_type: "other",
    related_type: "task",
  };

  return (
    <div>
      <TopBar title="Follow-ups" />
      <div className="p-5">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <Link
            href="/tasks/open"
            className="text-xs text-muted hover:text-text underline underline-offset-2"
          >
            View all open tasks &rarr;
          </Link>
        </div>
        <CalendarView
          kind="office"
          filters={filters}
          initialView="dayGridMonth"
          emptyState={
            <EmptyState
              icon={<CheckCheck className="w-8 h-8 opacity-60" aria-hidden="true" />}
              title="No follow-ups scheduled"
              description="Follow-ups created through the + New Follow-up button appear on a time grid here. Plain tasks without a scheduled time live in Open tasks."
              action={
                <Link href="/tasks/open" className={SECONDARY_ANCHOR}>
                  Go to tasks
                </Link>
              }
            />
          }
        />
      </div>
    </div>
  );
}
