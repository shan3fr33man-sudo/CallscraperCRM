"use client";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-accent text-white hover:bg-accent/90 active:bg-accent/80",
  secondary: "border border-border bg-panel text-text hover:bg-accent/5",
  ghost: "text-text hover:bg-accent/5",
  danger: "bg-red-600 text-white hover:bg-red-700",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "text-xs px-2 py-1 gap-1",
  md: "text-sm px-3 py-1.5 gap-1.5",
  lg: "text-sm px-4 py-2 gap-2",
};

/**
 * Primary button primitive. Always includes accessible focus ring,
 * disabled-cursor, and a loading spinner option. Use this everywhere
 * instead of raw <button className="bg-accent ..."> so focus/disabled
 * behavior stays consistent across the app.
 *
 * Examples:
 *   <Button onClick={save}>Save</Button>
 *   <Button variant="secondary" size="sm" icon={<Plus className="w-3 h-3" />}>Add</Button>
 *   <Button variant="danger" loading={submitting}>Delete</Button>
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading = false, icon, disabled, children, className = "", type = "button", ...rest },
  ref,
) {
  // No `ring-offset` — it requires a known background color and breaks on the
  // light-mode public estimate page. A plain 2px ring is visible on both the
  // dark app bg and the white public bg thanks to the accent color's saturation.
  const base =
    "inline-flex items-center justify-center rounded-md font-medium transition-colors " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 " +
    "disabled:opacity-50 disabled:cursor-not-allowed";
  const cls = `${base} ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`.trim();
  const isBusy = loading || disabled;
  return (
    <button ref={ref} type={type} disabled={isBusy} className={cls} aria-busy={loading || undefined} {...rest}>
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : icon}
      {children}
    </button>
  );
});
