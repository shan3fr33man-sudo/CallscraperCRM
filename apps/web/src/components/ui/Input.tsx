"use client";
import { forwardRef, useId, type InputHTMLAttributes } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Optional error message. When set, renders a red border and a paragraph
   * that the input references via aria-errormessage. */
  error?: string;
}

/**
 * Accessible input primitive. Consistent border/focus/error-ring behavior.
 * Pair with <Field> for label + htmlFor wiring, or pass `aria-label` directly.
 *
 * If you use this outside <Field>, the `id` used for aria-errormessage is
 * generated via useId when you don't pass one — so multiple errored Inputs
 * on the same page never collide.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { error, className = "", id, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = `${inputId}-error`;

  const base =
    "text-sm border rounded-md px-2 py-1.5 bg-bg text-text placeholder:text-muted " +
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:border-accent " +
    "disabled:opacity-60 disabled:cursor-not-allowed";
  const borderClass = error
    ? "border-red-500 focus-visible:ring-red-500/60 focus-visible:border-red-500"
    : "border-border";

  return (
    <>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={Boolean(error) || undefined}
        aria-errormessage={error ? errorId : undefined}
        className={`${base} ${borderClass} ${className}`.trim()}
        {...rest}
      />
      {error ? (
        // No role="alert" here — Field's wrapping paragraph handles announce
        // when used inside a Field; a standalone Input + error should be
        // surfaced as aria-errormessage references it.
        <p id={errorId} className="mt-1 text-xs text-red-500">
          {error}
        </p>
      ) : null}
    </>
  );
});
