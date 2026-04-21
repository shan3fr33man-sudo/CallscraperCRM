"use client";
import { useId, type ReactElement, type ReactNode, cloneElement, isValidElement } from "react";
import { Input, type InputProps } from "./Input";

export interface FieldProps {
  label: string;
  /** Optional descriptive help text shown below the label. */
  hint?: string;
  /** Optional error message. Pairs with Input's `error` prop for validation UI. */
  error?: string;
  required?: boolean;
  /** The input element. Its `id` will be auto-wired to the label's htmlFor. */
  children: ReactNode;
  className?: string;
}

/**
 * Label + input wrapper that guarantees proper htmlFor wiring. Pass a single
 * <Input>, <select>, <textarea>, or <Input>-compatible component as children;
 * we generate a stable id (or reuse the child's explicit id) and attach it
 * via cloneElement so the label is always correctly associated.
 *
 * Passes `error` and `required` through to the child only when the child
 * explicitly accepts them (our Input primitive). Native <input> / <select>
 * get `required`, `aria-invalid`, and `aria-describedby` via standard
 * attributes but NOT the custom `error` prop (which would warn in React).
 *
 * Usage:
 *   <Field label="Email" required error={errors.email}>
 *     <Input type="email" />
 *   </Field>
 */
export function Field({ label, hint, error, required, children, className = "" }: FieldProps) {
  const autoId = useId();

  // Resolve the final id ONCE so both the label's htmlFor and the child's
  // injected id agree — even when children is non-element (fragment, text, null).
  let injectedId = autoId;
  let control: ReactNode = children;

  if (isValidElement(children)) {
    const child = children as ReactElement<Record<string, unknown>>;
    const childProps = (child.props ?? {}) as Record<string, unknown>;
    const existingId = typeof childProps.id === "string" ? childProps.id : undefined;
    injectedId = existingId ?? autoId;

    // Compose aria-describedby from hint + error (both added below)
    const describedByIds: string[] = [];
    if (hint) describedByIds.push(`${injectedId}-hint`);
    if (error) describedByIds.push(`${injectedId}-error`);
    const describedBy = describedByIds.length > 0 ? describedByIds.join(" ") : undefined;

    // Only forward `error` to the child when the child is our Input primitive
    // (or another component we know accepts it). Native elements don't.
    const childIsInput = child.type === Input;

    const injectedProps: Record<string, unknown> = {
      id: injectedId,
      required: required ?? childProps.required,
    };
    if (describedBy) injectedProps["aria-describedby"] = describedBy;
    if (error) injectedProps["aria-invalid"] = true;
    if (childIsInput && error !== undefined) {
      (injectedProps as { error?: string }).error = error;
    }

    control = cloneElement(child, injectedProps as Partial<InputProps>);
  }

  return (
    <div className={className}>
      <label htmlFor={injectedId} className="text-xs text-muted block mb-1">
        {label}
        {required ? (
          <span aria-hidden="true" className="text-red-500 ml-0.5">
            *
          </span>
        ) : null}
        {required ? <span className="sr-only"> (required)</span> : null}
      </label>
      {control}
      {hint ? (
        <p id={`${injectedId}-hint`} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      ) : null}
      {error && !isInputChild(children) ? (
        <p id={`${injectedId}-error`} role="alert" className="mt-1 text-xs text-red-500">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function isInputChild(node: ReactNode): boolean {
  return isValidElement(node) && node.type === Input;
}
