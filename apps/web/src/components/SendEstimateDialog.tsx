"use client";
import { useEffect, useRef, useState } from "react";
import { Check, Copy, ExternalLink, Send, X } from "lucide-react";
import { Button, ErrorBanner } from "@/components/ui";

export interface SendEstimateDialogProps {
  open: boolean;
  estimateId: string;
  /** Pre-filled customer email from parent. Editable in the dialog. */
  defaultEmail?: string;
  /** Pre-filled customer phone. */
  defaultPhone?: string;
  onClose: () => void;
  /** Called after a successful send — lets the parent refresh its list. */
  onSent?: () => void;
}

interface SendResult {
  estimate: { id: string; sent_at: string };
  view_url: string;
  pdf_url: string;
  delivery: { email: boolean; sms: boolean };
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal dialog for sending an estimate. Two-step flow:
 *   1. Pick channel (email / sms / both), edit recipients, add optional message
 *   2. On send: show the view URL + PDF URL with copy actions and open link
 *
 * Keyboard: Escape closes, Tab traps inside the dialog. Initial focus lands
 * on the close button so screen-reader users know where they are. Dirty-state
 * guard prompts before discarding unsaved input on backdrop click.
 *
 * The API accepts `to_email` and `to_phone` independently so the "both"
 * channel correctly honors edits to either recipient.
 */
export function SendEstimateDialog({
  open,
  estimateId,
  defaultEmail = "",
  defaultPhone = "",
  onClose,
  onSent,
}: SendEstimateDialogProps) {
  const [channel, setChannel] = useState<"email" | "sms" | "both">("email");
  const [email, setEmail] = useState(defaultEmail);
  const [phone, setPhone] = useState(defaultPhone);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"view" | "pdf" | null>(null);

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const lastActiveElement = useRef<HTMLElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Snapshot defaults ONCE when the dialog opens so async parent updates
  // don't clobber the user's in-progress edits.
  const snapshotDone = useRef(false);

  // Reset + snapshot when opening
  useEffect(() => {
    if (!open) {
      snapshotDone.current = false;
      return;
    }
    if (snapshotDone.current) return;
    setResult(null);
    setError(null);
    setCopied(null);
    setEmail(defaultEmail);
    setPhone(defaultPhone);
    setMessage("");
    setSending(false);
    snapshotDone.current = true;
  }, [open, defaultEmail, defaultPhone]);

  // Keyboard + focus trap + focus restoration
  useEffect(() => {
    if (!open) return;
    lastActiveElement.current = document.activeElement as HTMLElement | null;
    // Initial focus
    const t = setTimeout(() => closeBtnRef.current?.focus(), 0);

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusables = dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      // Restore focus to the triggering element
      lastActiveElement.current?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Abort in-flight send on unmount
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  if (!open) return null;

  const isDirty = message.trim() !== "" || email !== defaultEmail || phone !== defaultPhone;

  function handleClose() {
    if (sending) return; // don't let the user close mid-send
    if (!result && isDirty) {
      const ok = window.confirm("Discard this message and close?");
      if (!ok) return;
    }
    onClose();
  }

  function handleBackdropClick() {
    handleClose();
  }

  async function onSend() {
    if (sending || result) return; // double-submit guard
    setSending(true);
    setError(null);
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const body: Record<string, unknown> = { channel };
      if (message.trim()) body.message = message.trim();
      // Send explicit email/phone so "both" mode honors both edits
      if (channel === "email" || channel === "both") body.to_email = email;
      if (channel === "sms" || channel === "both") body.to_phone = phone;
      const res = await fetch(`/api/estimates/${estimateId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ac.signal,
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error ?? "Failed to send");
        return;
      }
      setResult(j as SendResult);
      onSent?.();
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function copy(text: string, kind: "view" | "pdf") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      window.prompt("Copy this link:", text);
    }
  }

  const sendableChannelHasRecipient =
    (channel === "email" && email.trim() !== "") ||
    (channel === "sms" && phone.trim() !== "") ||
    (channel === "both" && (email.trim() !== "" || phone.trim() !== ""));

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={handleBackdropClick}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="send-est-title"
        aria-describedby="send-est-desc"
        className="w-full max-w-md bg-panel border border-border rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div id="send-est-title" className="text-sm font-semibold">
            {result ? "Estimate sent" : "Send estimate to customer"}
          </div>
          <button
            ref={closeBtnRef}
            onClick={handleClose}
            className="text-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 rounded"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div id="send-est-desc" className="px-4 py-4 space-y-3">
          {error ? <ErrorBanner message={error} /> : null}

          {!result ? (
            <>
              {/* Channel picker (radiogroup) */}
              <div role="radiogroup" aria-label="Delivery channel">
                <div className="text-xs text-muted mb-1">Deliver via</div>
                <div className="flex gap-1">
                  {(["email", "sms", "both"] as const).map((c) => (
                    <button
                      key={c}
                      role="radio"
                      aria-checked={channel === c}
                      onClick={() => setChannel(c)}
                      className={`text-xs px-3 py-1.5 rounded-md border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
                        channel === c
                          ? "bg-accent text-white border-accent"
                          : "border-border bg-bg"
                      }`}
                    >
                      {c === "email" ? "Email" : c === "sms" ? "SMS" : "Both"}
                    </button>
                  ))}
                </div>
              </div>

              {(channel === "email" || channel === "both") && (
                <div>
                  <label htmlFor="send-email" className="text-xs text-muted block mb-1">
                    Customer email
                    {defaultEmail && email !== defaultEmail ? (
                      <span className="ml-2 text-accent">(overriding {defaultEmail})</span>
                    ) : null}
                  </label>
                  <input
                    id="send-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full text-sm border border-border rounded-md px-2 py-1.5 bg-bg text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                    placeholder="customer@example.com"
                  />
                </div>
              )}

              {(channel === "sms" || channel === "both") && (
                <div>
                  <label htmlFor="send-phone" className="text-xs text-muted block mb-1">
                    Customer phone
                    {defaultPhone && phone !== defaultPhone ? (
                      <span className="ml-2 text-accent">(overriding {defaultPhone})</span>
                    ) : null}
                  </label>
                  <input
                    id="send-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full text-sm border border-border rounded-md px-2 py-1.5 bg-bg text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                    placeholder="+1 555 555 1234"
                  />
                </div>
              )}

              <div>
                <label htmlFor="send-message" className="text-xs text-muted block mb-1">
                  Message (optional)
                </label>
                <textarea
                  id="send-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  className="w-full text-sm border border-border rounded-md px-2 py-1.5 bg-bg text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 resize-y"
                  placeholder="Hi, your moving estimate is ready — let me know if you have any questions."
                />
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  onClick={onSend}
                  loading={sending}
                  disabled={!sendableChannelHasRecipient}
                  icon={<Send className="w-3 h-3" />}
                >
                  Send {channel === "both" ? "email & SMS" : channel}
                </Button>
                <Button variant="secondary" onClick={handleClose}>
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <SentResult
              result={result}
              onCopy={copy}
              copied={copied}
              onClose={onClose}
            />
          )}
        </div>
      </div>

      {/* Polite live region for copy-to-clipboard confirmation */}
      <div aria-live="polite" className="sr-only">
        {copied === "view" ? "Customer view link copied" : copied === "pdf" ? "PDF link copied" : ""}
      </div>
    </div>
  );
}

function SentResult({
  result,
  onCopy,
  copied,
  onClose,
}: {
  result: SendResult;
  onCopy: (s: string, kind: "view" | "pdf") => void;
  copied: "view" | "pdf" | null;
  onClose: () => void;
}) {
  const delivered =
    (result.delivery.email ? ["email"] : []).concat(result.delivery.sms ? ["SMS"] : []).join(" & ");
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-green-500">
        <Check className="w-4 h-4" />
        {delivered ? `Queued for ${delivered} delivery` : "Estimate marked as sent"}
      </div>
      {!delivered ? (
        <p className="text-xs text-muted">
          No recipients configured for this estimate. Use the copyable link below to deliver manually.
        </p>
      ) : (
        <p className="text-xs text-muted">
          Delivery is stub-only until the Resend/Twilio providers are wired — the message is logged to{" "}
          <code>email_logs</code>/<code>sms_logs</code>. Share the link below as a backup.
        </p>
      )}

      <LinkRow
        label="Customer view"
        url={result.view_url}
        copied={copied === "view"}
        onCopy={() => onCopy(result.view_url, "view")}
      />
      <LinkRow
        label="PDF"
        url={result.pdf_url}
        copied={copied === "pdf"}
        onCopy={() => onCopy(result.pdf_url, "pdf")}
      />

      <div className="flex gap-2 pt-1">
        <Button onClick={onClose}>Done</Button>
        <a
          href={result.view_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-md border border-border hover:bg-accent/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          <ExternalLink className="w-3 h-3" /> Open
        </a>
      </div>
    </div>
  );
}

function LinkRow({
  label,
  url,
  copied,
  onCopy,
}: {
  label: string;
  url: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div>
      <div className="text-xs text-muted mb-1">{label}</div>
      <div className="flex gap-2">
        <input
          readOnly
          value={url}
          className="flex-1 text-xs font-mono border border-border rounded-md px-2 py-1.5 bg-bg text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          onFocus={(e) => e.currentTarget.select()}
        />
        <Button
          variant="secondary"
          size="sm"
          onClick={onCopy}
          icon={copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
        >
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}
