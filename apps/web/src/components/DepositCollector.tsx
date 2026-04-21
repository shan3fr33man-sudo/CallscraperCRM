"use client";
import { useState } from "react";
import { Check, DollarSign, Loader2 } from "lucide-react";

/**
 * Records a manual deposit payment (cash/check) against an estimate.
 * Card payments come in Phase 4 via Stripe.
 */
export function DepositCollector({
  estimateId,
  customerId,
  defaultAmount = 0,
  onPaid,
}: {
  estimateId: string;
  customerId?: string | null;
  defaultAmount?: number;
  onPaid?: () => void;
}) {
  const [amount, setAmount] = useState(defaultAmount);
  const [method, setMethod] = useState<"cash" | "check" | "card">("cash");
  const [reference, setReference] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    if (!amount || amount <= 0) {
      setError("Enter an amount greater than $0");
      return;
    }
    if (method === "card") {
      setError("Card payments use the Stripe flow (coming in v1.1 Phase 4).");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount,
        method,
        estimate_id: estimateId,
        customer_id: customerId ?? null,
        reference: reference || null,
      }),
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
      <div className="border border-green-200 bg-green-50 rounded-md p-3 text-sm text-green-700 flex items-center gap-2">
        <Check className="w-4 h-4" /> ${amount.toFixed(2)} {method} payment recorded.
      </div>
    );
  }

  return (
    <div className="border border-border rounded-md p-3 bg-accent/5">
      <h4 className="text-sm font-semibold mb-3 flex items-center gap-1">
        <DollarSign className="w-4 h-4" /> Record deposit
      </h4>
      <div className="space-y-2">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Amount</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
            className="text-sm border border-border rounded-md px-2 py-1.5 bg-background w-full"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Method</label>
          <div className="flex gap-1">
            {(["cash", "check", "card"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMethod(m)}
                className={`text-xs px-3 py-1.5 rounded-md border ${
                  method === m
                    ? "bg-accent text-white border-accent"
                    : "border-border bg-background"
                }`}
              >
                {m === "card" ? "Card (Stripe)" : m[0].toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
        </div>
        {method === "check" && (
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Check #</label>
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="text-sm border border-border rounded-md px-2 py-1.5 bg-background w-full"
            />
          </div>
        )}
        {error && <div className="text-xs text-red-500">{error}</div>}
        <button
          onClick={submit}
          disabled={submitting}
          className="flex items-center gap-1 text-sm bg-accent text-white px-4 py-1.5 rounded-md disabled:opacity-60"
        >
          {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
          Record payment
        </button>
      </div>
    </div>
  );
}
