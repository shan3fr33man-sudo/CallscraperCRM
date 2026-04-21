"use client";
import { AlertTriangle } from "lucide-react";

export interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
}

/**
 * Inline error banner for surfacing swallowed API failures. Pair with a
 * `try { ... } catch (e) { setError(...) }` in page-level useEffects so
 * network failures are visible to the user instead of silently rendering
 * an empty table (design audit finding #4).
 */
export function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 border border-red-500/40 bg-red-500/5 rounded-md px-3 py-2 text-xs"
    >
      <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <div className="font-medium text-red-500">Something went wrong</div>
        <div className="text-red-400 mt-0.5">{message}</div>
      </div>
      {onRetry ? (
        <button
          onClick={onRetry}
          className="text-xs text-red-500 hover:text-red-400 underline"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}
