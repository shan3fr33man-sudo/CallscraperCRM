"use client";
import { useEffect, useRef, useState } from "react";
import { Check, Copy, ExternalLink, Send, X } from "lucide-react";
import { Button, ErrorBanner } from "@/components/ui";

export interface SendInvoiceDialogProps {
  open: boolean;
  invoiceId: string;
  defaultEmail?: string;
  defaultPhone?: string;
  onClose: () => void;
  onSent?: () => void;
}

interface SendResult {
  invoice: { id: string; invoice_number: string };
  pdf_url: string;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Invoice-send dialog. Mirrors SendEstimateDialog but hits
 * /api/invoices/[id]/send. The invoice "public view" is just the PDF itself
 * (no signable canvas), so the success state shows the PDF URL with copy +
 * open actions.
 *
 * Keyboard: Escape closes, Tab traps within the dialog. Initial focus on
 * the close button. Dirty-state guard prompts before discarding unsent input.
 */
export function SendInvoiceDialog({
  open,
  invoiceId,
  defaultEmail = "",
  defaultPhone = "",
  onClose,
  onSent,
}: SendInvoiceDialogProps) {
  const [channel, setChannel] = useState<"email" | "sms" | "both">("email");
  const [email, setEmail] = useState(defaultEmail);
  const [phone, setPhone] = useState(defaultPhone);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const lastActiveElement = useRef<HTMLElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const snapshotDone = useRef(false);

  useEffect(() => {
    if (!open) {
      snapshotDone.current = false;
      return;
    }
    if (snapshotDone.current) return;
    setResult(null);
    setError(null);
    setCopied(false);
    setEmail(defaultEmail);
    setPhone(defaultPhone);
    setMessage("");
    setSending(false);
    snapshotDone.current = true;
  }, [open, defaultEmail, defaultPhone]);

  useEffect(() => {
    if (!open) return;
    lastActiveElement.current = document.activeElement as HTMLElement | null;
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
      lastActiveElement.current?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  if (!open) return null;

  const isDirty = message.trim() !== "" || email !== defaultEmail || phone !== defaultPhone;

  function handleClose() {
    if (sending) return;
    if (!result && isDirty) {
      if (!window.confirm("Discard this message and close?")) return;
    }
    onClose();
  }

  async function onSend() {
    if (sending || result) return;
    setSending(true);
    setError(null);
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const body: Record<string, unknown> = { channel };
      if (message.trim()) body.message = message.trim();
      if (channel === "email" || channel === "both") body.to_email = email;
      if (channel === "sms" || channel === "both") body.to_phone = phone;
      const res = await fetch(`/api/invoices/${invoiceId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ac.signal,
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error ?? "Failed to send invoice");
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

  async function copyPdfLink() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.pdf_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("Copy this link:", result.pdf_url);
    }
  }

  const sendable =
    (channel === "email" && email.trim() !== "") ||
    (channel === "sms" && phone.trim() !== "") ||
    (channel === "both" && (email.trim() !== "" || phone.trim() !== ""));

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={handleClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="send-inv-title"
        aria-describedby="send-inv-desc"
        className="w-full max-w-md bg-panel border border-border rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div id="send-inv-title" className="text-sm font-semibold">
            {result ? "Invoice sent" : "Send invoice to customer"}
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

        <div id="send-inv-desc" className="px-4 py-4 space-y-3">
          {error ? <ErrorBanner message={error} /> : null}

          {!result ? (
            <>
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
                  <label htmlFor="inv-send-email" className="text-xs text-muted block mb-1">
                    Customer email
                  </label>
                  <input
                    id="inv-send-email"
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
                  <label htmlFor="inv-send-phone" className="text-xs text-muted block mb-1">
                    Customer phone
                  </label>
                  <input
                    id="inv-send-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full text-sm border border-border rounded-md px-2 py-1.5 bg-bg text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                    placeholder="+1 555 555 1234"
                  />
                </div>
              )}

              <div>
                <label htmlFor="inv-send-message" className="text-xs text-muted block mb-1">
                  Message (optional)
                </label>
                <textarea
                  id="inv-send-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  className="w-full text-sm border border-border rounded-md px-2 py-1.5 bg-bg text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 resize-y"
                  placeholder="Hi, attaching invoice for your completed move. Payment is due in 14 days."
                />
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  onClick={onSend}
                  loading={sending}
                  disabled={!sendable}
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
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-green-500">
                <Check className="w-4 h-4" />
                Invoice #{result.invoice.invoice_number} queued for delivery
              </div>
              <p className="text-xs text-muted">
                Delivery is stub-only until Resend/Twilio providers are wired — the
                message is logged. Share the link below as a backup.
              </p>

              <div>
                <div className="text-xs text-muted mb-1">Invoice PDF</div>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={result.pdf_url}
                    className="flex-1 text-xs font-mono border border-border rounded-md px-2 py-1.5 bg-bg text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={copyPdfLink}
                    icon={copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                  >
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <Button onClick={onClose}>Done</Button>
                <a
                  href={result.pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-md border border-border hover:bg-accent/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                >
                  <ExternalLink className="w-3 h-3" /> Open PDF
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      <div aria-live="polite" className="sr-only">
        {copied ? "PDF link copied" : ""}
      </div>
    </div>
  );
}
