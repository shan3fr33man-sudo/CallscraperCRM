"use client";

import { use, useEffect, useId, useState } from "react";
import { Check, Download, Loader2 } from "lucide-react";
import { SignatureCanvas } from "@/components/SignatureCanvas";

type LineItem = {
  label: string;
  rate?: number;
  quantity?: number;
  unit?: string;
  subtotal: number;
};

type ViewData = {
  estimate: {
    id: string;
    number: string;
    type: string;
    amount: number;
    subtotal: number;
    sales_tax: number;
    discounts: number;
    deposit_amount: number;
    valid_until: string | null;
    sent_at: string | null;
    accepted_at: string | null;
    service_date: string | null;
    line_items: LineItem[] | null;
    origin?: string;
    destination?: string;
  };
  customer: { name: string; email: string };
  company: { name?: string; address?: string; phone?: string };
};

export default function PublicEstimatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const nameId = useId();
  const emailId = useId();
  const errorId = useId();
  const [data, setData] = useState<ViewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [signature, setSignature] = useState("");
  // Field-keyed errors so aria-invalid attaches to exactly the wrong field
  // (substring-matching a free-form string was brittle — e.g. "name" matches
  // "company name missing"). `form` is for non-field errors (network, server).
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    signature?: string;
    form?: string;
  }>({});
  const [justSigned, setJustSigned] = useState(false);
  // Combined error message for the alert region. Picks the first field error
  // so screen readers hear something specific, falling back to the form-level
  // error.
  const firstError = errors.form ?? errors.name ?? errors.email ?? errors.signature;

  useEffect(() => {
    // Extract token from URL on mount
    const params = new URLSearchParams(window.location.search);
    const t = params.get("t");
    setToken(t);
    if (!t) {
      setLoadError("This link is missing its access token. Ask the sender to resend.");
      setLoading(false);
      return;
    }
    fetch(`/api/estimates/${id}/view?t=${encodeURIComponent(t)}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) {
          setLoadError(j.error ?? "This link is invalid or expired.");
          setLoading(false);
          return;
        }
        setData(j);
        setSignerName(j.customer?.name ?? "");
        setSignerEmail(j.customer?.email ?? "");
        setLoading(false);
      })
      .catch(() => {
        setLoadError("Failed to load estimate.");
        setLoading(false);
      });
  }, [id]);

  async function submitSignature() {
    setErrors({});
    if (!token) {
      setErrors({ form: "Missing access token. Ask the sender to resend the link." });
      return;
    }
    const next: typeof errors = {};
    if (!signerName.trim()) next.name = "Please type your full name";
    if (!signature) next.signature = "Please sign above";
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }
    setSigning(true);
    try {
      const res = await fetch(`/api/estimates/${id}/sign?t=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signer_name: signerName,
          signer_email: signerEmail,
          signature_data: signature,
        }),
      });
      const j = await res.json();
      if (j.ok) {
        setJustSigned(true);
        // Reload view state
        const v = await fetch(`/api/estimates/${id}/view?t=${encodeURIComponent(token)}`).then((r) => r.json());
        setData(v);
      } else {
        setErrors({ form: j.error ?? "Failed to sign. Please try again." });
      }
    } catch {
      setErrors({ form: "Couldn't reach the server. Check your connection and try again." });
    } finally {
      setSigning(false);
    }
  }

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-gray-50"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <Loader2 className="w-5 h-5 animate-spin text-gray-500" aria-hidden="true" />
        <span className="sr-only">Loading your estimate…</span>
      </div>
    );
  }

  if (loadError || !data) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6 bg-gray-50 text-gray-900">
        <div className="max-w-md text-center">
          <h1 className="text-lg font-semibold mb-2">Can&apos;t open this estimate</h1>
          <p className="text-sm text-gray-600">{loadError ?? "Estimate not found."}</p>
        </div>
      </main>
    );
  }

  const { estimate, customer, company } = data;
  const alreadyAccepted = Boolean(estimate.accepted_at) || justSigned;

  return (
    <main className="min-h-screen bg-gray-50 py-10 text-gray-900">
      <article className="max-w-3xl mx-auto bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        {/* Header */}
        <header className="px-8 py-6 border-b border-gray-200 flex items-start justify-between gap-4">
          <div>
            <div className="text-lg font-semibold">{company?.name ?? "Moving Company"}</div>
            {company?.address ? (
              <div className="text-xs text-gray-500 mt-0.5">{company.address}</div>
            ) : null}
            {company?.phone ? (
              <div className="text-xs text-gray-500">
                <a
                  href={`tel:${company.phone.replace(/[^\d+]/g, "")}`}
                  className="hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 rounded"
                >
                  {company.phone}
                </a>
              </div>
            ) : null}
          </div>
          <div className="text-right">
            <h1 className="text-2xl font-bold text-gray-700">ESTIMATE</h1>
            <div className="text-sm text-gray-500 mt-1">
              <span className="sr-only">Estimate number </span>#{estimate.number}
            </div>
            {estimate.valid_until ? (
              <div className="text-xs text-gray-400 mt-1">Valid until {estimate.valid_until}</div>
            ) : null}
          </div>
        </header>

        {/* Acceptance banner */}
        {alreadyAccepted && (
          <div
            role="status"
            aria-live="polite"
            className="px-8 py-3 bg-green-50 border-b border-green-200 flex items-center gap-2 text-sm text-green-700"
          >
            <Check className="w-4 h-4" aria-hidden="true" />
            This estimate has been signed{estimate.accepted_at ? ` on ${estimate.accepted_at.slice(0, 10)}` : ""}.
          </div>
        )}

        {/* Details */}
        <div className="px-8 py-6">
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Customer</div>
              <div className="text-sm font-medium">{customer.name}</div>
              {customer.email ? <div className="text-xs text-gray-500">{customer.email}</div> : null}
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Service</div>
              {estimate.service_date ? (
                <div className="text-sm">Date: {estimate.service_date}</div>
              ) : null}
              {estimate.origin ? <div className="text-xs text-gray-600">From: {estimate.origin}</div> : null}
              {estimate.destination ? (
                <div className="text-xs text-gray-600">To: {estimate.destination}</div>
              ) : null}
            </div>
          </div>

          {/* Line items */}
          <table className="w-full text-sm mb-4">
            <thead className="border-b-2 border-gray-300">
              <tr>
                <th className="text-left py-2">Description</th>
                <th className="text-right py-2 w-20">Qty</th>
                <th className="text-right py-2 w-24">Rate</th>
                <th className="text-right py-2 w-28">Amount</th>
              </tr>
            </thead>
            <tbody>
              {(estimate.line_items ?? []).map((li, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-2">{li.label}</td>
                  <td className="py-2 text-right">
                    {li.quantity ?? 1} {li.unit ?? ""}
                  </td>
                  <td className="py-2 text-right font-mono">${(li.rate ?? 0).toFixed(2)}</td>
                  <td className="py-2 text-right font-mono">${li.subtotal.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="ml-auto w-64 space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="font-mono">${estimate.subtotal.toFixed(2)}</span>
            </div>
            {estimate.discounts > 0 && (
              <div className="flex justify-between text-gray-500">
                <span>Discounts</span>
                <span className="font-mono">-${estimate.discounts.toFixed(2)}</span>
              </div>
            )}
            {estimate.sales_tax > 0 && (
              <div className="flex justify-between text-gray-500">
                <span>Sales tax</span>
                <span className="font-mono">${estimate.sales_tax.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t border-gray-300 text-base font-bold">
              <span>Total</span>
              <span className="font-mono">${estimate.amount.toFixed(2)}</span>
            </div>
            {estimate.deposit_amount > 0 && (
              <div className="flex justify-between text-xs text-gray-500">
                <span>Deposit due</span>
                <span className="font-mono">${estimate.deposit_amount.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Download + sign */}
          <div className="mt-8 pt-6 border-t border-gray-200 flex flex-col gap-4">
            {token ? (
              <a
                href={`/api/estimates/${estimate.id}/pdf?t=${encodeURIComponent(token)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline self-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 rounded"
              >
                <Download className="w-3 h-3" aria-hidden="true" /> Download PDF
              </a>
            ) : null}

            {!alreadyAccepted && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submitSignature();
                }}
                className="border border-gray-200 rounded-md p-4 bg-gray-50"
                aria-describedby={firstError ? errorId : undefined}
              >
                <h2 className="text-sm font-semibold mb-3">Accept &amp; sign this estimate</h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  <div>
                    <label htmlFor={nameId} className="text-xs text-gray-500 block mb-1">
                      Full name <span className="text-red-500" aria-hidden="true">*</span>
                      <span className="sr-only"> (required)</span>
                    </label>
                    <input
                      id={nameId}
                      required
                      autoComplete="name"
                      value={signerName}
                      onChange={(e) => {
                        setSignerName(e.target.value);
                        if (errors.name) setErrors((p) => ({ ...p, name: undefined }));
                      }}
                      aria-invalid={errors.name ? true : undefined}
                      aria-errormessage={errors.name ? errorId : undefined}
                      className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 bg-white text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:border-blue-600 aria-[invalid=true]:border-red-500"
                    />
                  </div>
                  <div>
                    <label htmlFor={emailId} className="text-xs text-gray-500 block mb-1">
                      Email (optional)
                    </label>
                    <input
                      id={emailId}
                      type="email"
                      autoComplete="email"
                      value={signerEmail}
                      onChange={(e) => {
                        setSignerEmail(e.target.value);
                        if (errors.email) setErrors((p) => ({ ...p, email: undefined }));
                      }}
                      aria-invalid={errors.email ? true : undefined}
                      aria-errormessage={errors.email ? errorId : undefined}
                      className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 bg-white text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:border-blue-600 aria-[invalid=true]:border-red-500"
                    />
                  </div>
                </div>

                <div
                  className={errors.signature ? "ring-2 ring-red-500 rounded-md" : undefined}
                >
                  <SignatureCanvas
                    onChange={(v) => {
                      setSignature(v);
                      if (v && errors.signature) setErrors((p) => ({ ...p, signature: undefined }));
                    }}
                    width={400}
                    height={140}
                  />
                </div>

                {firstError ? (
                  <p id={errorId} role="alert" className="text-sm text-red-600 mt-2">
                    {firstError}
                  </p>
                ) : null}

                {/* aria-live region announces submit progress + success to screen
                    readers without visually competing with the in-button spinner. */}
                <p className="sr-only" role="status" aria-live="polite">
                  {signing ? "Signing estimate, please wait" : justSigned ? "Estimate signed successfully" : ""}
                </p>

                <button
                  type="submit"
                  disabled={signing}
                  aria-busy={signing || undefined}
                  className="mt-4 inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm px-4 py-2 rounded-md disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-green-700 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-50"
                >
                  {signing ? (
                    <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                  ) : (
                    <Check className="w-3 h-3" aria-hidden="true" />
                  )}
                  {signing ? "Signing\u2026" : "Accept & sign"}
                </button>
                <p className="text-xs text-gray-500 mt-2">
                  By signing, you agree to the terms of this estimate.
                </p>
              </form>
            )}
          </div>
        </div>
      </article>
    </main>
  );
}
