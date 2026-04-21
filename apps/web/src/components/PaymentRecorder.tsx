"use client";
import { useState } from "react";
import { Check, DollarSign } from "lucide-react";
import { Button, ErrorBanner } from "@/components/ui";

export type PaymentMethod = "cash" | "check" | "card" | "ach";
export type PaymentTarget =
  | { kind: "estimate"; estimate_id: string }
  | { kind: "invoice"; invoice_id: string };

export interface PaymentRecorderProps {
  /** What the payment is being applied to. Determines the API request shape. */
  target: PaymentTarget;
  /** Optional customer id for audit linkage. */
  customerId?: string | null;
  /** Pre-fill amount (e.g. the deposit amount or invoice balance). */
  defaultAmount?: number;
  /**
   * Optional upper bound beyond which we show an overpayment warning and
   * require an explicit confirm before submit. Pass the invoice balance or
   * deposit amount. The payment itself is still recorded at the entered
   * amount — the DB trigger clamps balance to 0 so overpayments don't go
   * negative. The warning exists so a typo doesn't silently become a
   * multi-thousand-dollar overpayment.
   */
  maxHint?: number;
  /** Called after a successful payment insert — lets the parent refetch. */
  onPaid?: () => void;
  /** Override the section title. Defaults based on target.kind. */
  title?: string;
  /** Optional className passed through to the outer container. */
  className?: string;
}

/**
 * Generalized payment entry form. Handles cash/check/ACH today and keeps the
 * `card` option visible but disabled with a tooltip pointing at the Stripe
 * integration that lands in the last phase of v1.1. DO NOT strip the card
 * branch when simplifying — per BLOCKERS.md, the seam stays alive so Stripe
 * wiring drops in cleanly without UI rework.
 *
 * Replaces the old DepositCollector component; that component is now a thin
 * wrapper around this one to keep existing estimate-deposit call sites
 * working.
 */
export function PaymentRecorder({
  target,
  customerId,
  defaultAmount = 0,
  maxHint,
  onPaid,
  title,
  className = "",
}: PaymentRecorderProps) {
  const [amount, setAmount] = useState(defaultAmount);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [reference, setReference] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const overpayment = typeof maxHint === "number" && amount > maxHint + 0.009;

  async function submit() {
    setError("");
    if (submitting || done) return;
    if (!amount || amount <= 0) {
      setError("Enter an amount greater than $0");
      return;
    }
    if (method === "card") {
      setError("Card payments go through the Stripe flow (wired in the final Phase 4 of v1.1).");
      return;
    }
    if (method === "check" && !reference.trim()) {
      setError("Enter the check number for audit tracking.");
      return;
    }
    if (overpayment) {
      const diff = amount - (maxHint ?? 0);
      const ok = window.confirm(
        `You entered $${amount.toFixed(2)} — that's $${diff.toFixed(2)} more than the balance due ($${(maxHint ?? 0).toFixed(2)}).\n\nContinue and record the full $${amount.toFixed(2)}?`,
      );
      if (!ok) return;
    }
    setSubmitting(true);
    const body: Record<string, unknown> = {
      amount,
      method,
      customer_id: customerId ?? null,
      reference: reference || null,
    };
    if (target.kind === "estimate") body.estimate_id = target.estimate_id;
    else body.invoice_id = target.invoice_id;

    const res = await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await res.json();
    setSubmitting(false);
    if (j.payment) {
      setDone(true);
      onPaid?.();
    } else {
      setError(j.error ?? "Failed to record payment");
    }
  }

  if (done) {
    return (
      <div
        role="status"
        aria-live="polite"
        className={`border border-green-500/40 bg-green-500/5 rounded-md p-3 text-sm text-green-500 flex items-center gap-2 ${className}`.trim()}
      >
        <Check className="w-4 h-4" /> ${amount.toFixed(2)} {method} payment recorded.
      </div>
    );
  }

  const defaultTitle = target.kind === "estimate" ? "Record deposit" : "Record payment";

  return (
    <div className={`border border-border rounded-md p-3 bg-accent/5 ${className}`.trim()}>
      <h4 className="text-sm font-semibold mb-3 flex items-center gap-1">
        <DollarSign className="w-4 h-4" /> {title ?? defaultTitle}
      </h4>
      <div className="space-y-2">
        <div>
          <label htmlFor="payment-amount" className="text-xs text-muted block mb-1">
            Amount
          </label>
          <input
            id="payment-amount"
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
            className="text-sm border border-border rounded-md px-2 py-1.5 bg-bg text-text w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          />
        </div>
        <div>
          <div className="text-xs text-muted block mb-1">Method</div>
          <div
            role="radiogroup"
            aria-label="Payment method"
            className="flex gap-1 flex-wrap"
          >
            {(["cash", "check", "ach", "card"] as const).map((m) => {
              const disabled = m === "card"; // Stripe flow lands in Phase 4
              const label = m === "card"
                ? "Card (Stripe — Phase 4)"
                : m === "ach"
                  ? "ACH"
                  : m[0].toUpperCase() + m.slice(1);
              return (
                <button
                  key={m}
                  role="radio"
                  aria-checked={method === m}
                  onClick={() => !disabled && setMethod(m)}
                  disabled={disabled}
                  title={disabled ? "Card payments wire up in Phase 4" : undefined}
                  className={`text-xs px-3 py-1.5 rounded-md border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
                    method === m
                      ? "bg-accent text-white border-accent"
                      : "border-border bg-bg"
                  } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        {method === "check" && (
          <div>
            <label htmlFor="payment-ref" className="text-xs text-muted block mb-1">
              Check #
            </label>
            <input
              id="payment-ref"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="1234"
              className="text-sm border border-border rounded-md px-2 py-1.5 bg-bg text-text w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            />
          </div>
        )}
        {method === "ach" && (
          <div>
            <label htmlFor="payment-ref-ach" className="text-xs text-muted block mb-1">
              ACH reference (optional)
            </label>
            <input
              id="payment-ref-ach"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Trace ID or memo"
              className="text-sm border border-border rounded-md px-2 py-1.5 bg-bg text-text w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            />
          </div>
        )}
        {overpayment ? (
          <div className="text-xs text-amber-500 bg-amber-500/10 border border-amber-500/30 rounded-md px-2 py-1.5">
            Heads up: ${amount.toFixed(2)} exceeds the remaining balance of
            ${(maxHint ?? 0).toFixed(2)} by ${(amount - (maxHint ?? 0)).toFixed(2)}.
            You&apos;ll be asked to confirm.
          </div>
        ) : null}
        {error ? <ErrorBanner message={error} /> : null}
        <Button onClick={submit} loading={submitting} icon={<Check className="w-3 h-3" />}>
          Record payment
        </Button>
      </div>
    </div>
  );
}
