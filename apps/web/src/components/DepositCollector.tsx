"use client";
import { PaymentRecorder } from "@/components/PaymentRecorder";

/**
 * DepositCollector is now a thin wrapper around {@link PaymentRecorder}
 * targeted at an estimate. Kept as a distinct export so existing callers
 * (EstimateTab, etc.) don't need to change. For new code, prefer
 * `<PaymentRecorder target={{ kind: "estimate" | "invoice", ... }} />`
 * directly.
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
  return (
    <PaymentRecorder
      target={{ kind: "estimate", estimate_id: estimateId }}
      customerId={customerId}
      defaultAmount={defaultAmount}
      onPaid={onPaid}
      title="Record deposit"
    />
  );
}
