/**
 * Design tokens. Single source of truth for colors, spacing, typography.
 * Mirrors apps/web/tailwind.config.ts so components can reference tokens
 * in prop types (e.g. `variant: TokenColorName`) while still using Tailwind
 * utility classes at render time.
 *
 * If you add a color here, also add it to tailwind.config.ts `extend.colors`.
 */

// ─── Base palette (dark-theme-first; matches tailwind.config.ts) ──────
export const palette = {
  bg: "#0a0a0a", // page background
  panel: "#111113", // cards, sidebar
  border: "#1f1f23", // 1px dividers
  muted: "#7a7a85", // secondary text
  text: "#e7e7ea", // primary text
  accent: "#7c5cff", // primary actions, brand
  // Status palette (not yet in tailwind config — these use opacity classes
  // against standard Tailwind colors like green-600/50)
  success: "#16a34a", // Tailwind green-600
  warning: "#f59e0b", // Tailwind amber-500
  danger: "#ef4444", // Tailwind red-500
  info: "#3b82f6", // Tailwind blue-500
} as const;

export type TokenColorName = keyof typeof palette;

// ─── Spacing scale (matches Tailwind's default 4px base) ──────────────
// Referenced by props on Field, EmptyState for consistent vertical rhythm.
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
} as const;

// ─── Status → className map (shared by StatusBadge + ad-hoc usage) ───
// Keep this in sync with actual DB enum values (migration 0006 CHECKs).
//
// Styling philosophy: the internal app is dark-theme-first and does NOT use
// Tailwind's dark-mode class strategy. We use low-saturation tints of the
// Tailwind palette that read well on both the dark panel backgrounds AND
// the one light surface (`/estimate/[id]`). Using `/30` alpha keeps the
// backgrounds readable on either theme without needing `dark:` prefixes
// (which wouldn't work anyway — darkMode isn't configured in tailwind.config.ts).
export const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
  // Invoice statuses
  draft: { bg: "bg-accent/10", text: "text-accent", label: "Draft" },
  sent: { bg: "bg-blue-500/15", text: "text-blue-500", label: "Sent" },
  partial: { bg: "bg-amber-500/15", text: "text-amber-500", label: "Partial" },
  paid: { bg: "bg-green-500/15", text: "text-green-500", label: "Paid" },
  overdue: { bg: "bg-red-500/15", text: "text-red-500", label: "Overdue" },
  void: { bg: "bg-muted/10", text: "text-muted", label: "Void" },
  // Estimate statuses
  accepted: { bg: "bg-green-500/15", text: "text-green-500", label: "Accepted" },
  declined: { bg: "bg-red-500/15", text: "text-red-500", label: "Declined" },
  // Task statuses
  not_started: { bg: "bg-muted/10", text: "text-muted", label: "Not started" },
  in_progress: { bg: "bg-blue-500/15", text: "text-blue-500", label: "In progress" },
  completed: { bg: "bg-green-500/15", text: "text-green-500", label: "Completed" },
  // Job statuses (additional to above)
  booked: { bg: "bg-blue-500/15", text: "text-blue-500", label: "Booked" },
  confirmed: { bg: "bg-green-500/15", text: "text-green-500", label: "Confirmed" },
  en_route: { bg: "bg-amber-500/15", text: "text-amber-500", label: "En route" },
  finished: { bg: "bg-muted/10", text: "text-muted", label: "Finished" },
  // Customer statuses
  new: { bg: "bg-accent/10", text: "text-accent", label: "New" },
  active: { bg: "bg-green-500/15", text: "text-green-500", label: "Active" },
  archived: { bg: "bg-muted/10", text: "text-muted", label: "Archived" },
};

const NEUTRAL_STYLE = { bg: "bg-muted/10", text: "text-muted", label: "—" };

/** Look up the styling for a status value; falls back to a neutral pill.
 * Case-insensitive: "Paid" matches "paid". */
export function getStatusStyle(status: string | null | undefined) {
  if (!status) return NEUTRAL_STYLE;
  const key = status.toLowerCase();
  const match = statusStyles[key];
  if (match) return match;
  // Unknown status — return neutral style but keep the raw value as the label
  return { ...NEUTRAL_STYLE, label: status };
}
