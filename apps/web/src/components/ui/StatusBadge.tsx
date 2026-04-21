"use client";
import { getStatusStyle } from "@/lib/tokens";

export interface StatusBadgeProps {
  status: string | null | undefined;
  /** Override the displayed label (default: derived from status via tokens.ts) */
  label?: string;
  size?: "xs" | "sm";
}

/**
 * Consolidated status pill. Given any recognized status value (invoice,
 * estimate, task, job, customer), renders a consistent badge. Unknown
 * statuses fall back to a neutral pill displaying the raw value.
 */
export function StatusBadge({ status, label, size = "xs" }: StatusBadgeProps) {
  const { bg, text, label: defaultLabel } = getStatusStyle(status ?? undefined);
  const sizeCls = size === "sm" ? "text-sm px-2.5 py-1" : "text-xs px-2 py-0.5";
  return (
    <span className={`inline-flex items-center rounded font-medium ${sizeCls} ${bg} ${text}`}>
      {label ?? defaultLabel}
    </span>
  );
}
