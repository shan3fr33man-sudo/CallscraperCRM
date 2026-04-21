"use client";
import type { ReactNode } from "react";
import { Inbox } from "lucide-react";

export interface EmptyStateProps {
  /** Icon rendered above the title. Defaults to a neutral inbox icon. */
  icon?: ReactNode;
  title: string;
  /** Optional descriptive prose below the title. */
  description?: string;
  /** Optional CTA button or link — gives the user a path forward. */
  action?: ReactNode;
  /** Override for tight spaces (e.g. inside a table cell) */
  compact?: boolean;
}

/**
 * Standardized empty state. Use wherever a list renders 0 items — instead of
 * a bare "No records" string, show guidance and (ideally) a CTA.
 *
 * Examples:
 *   <EmptyState title="No invoices yet" description="Generated invoices appear here." />
 *   <EmptyState
 *     icon={<Calendar className="w-6 h-6" />}
 *     title="Nothing on the calendar this week"
 *     action={<Button onClick={openNewEvent}>Schedule an estimate</Button>}
 *   />
 */
export function EmptyState({ icon, title, description, action, compact }: EmptyStateProps) {
  // No role="status" — it's an aria-live region which would announce on every
  // list refetch. Empty states are decorative guidance, not live notifications.
  return (
    <div
      className={`flex flex-col items-center justify-center text-center border border-dashed border-border rounded-md bg-bg ${
        compact ? "py-6 px-4" : "py-10 px-6"
      }`}
    >
      <div className="text-muted mb-3">{icon ?? <Inbox className="w-6 h-6" />}</div>
      <h3 className="text-sm font-semibold text-text">{title}</h3>
      {description ? (
        <p className="text-xs text-muted mt-1 max-w-md">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
