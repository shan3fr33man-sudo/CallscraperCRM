"use client";
import { useEffect, useState } from "react";
import { Plus, Send, FileText, Check, ExternalLink, Sparkles, AlertCircle } from "lucide-react";
import { InventoryEditor } from "@/components/InventoryEditor";
import { DepositCollector } from "@/components/DepositCollector";
import { SendEstimateDialog } from "@/components/SendEstimateDialog";
import { LineItemEditor, type LineItem } from "@/components/LineItemEditor";
import { Button, EmptyState } from "@/components/ui";
import { Pencil } from "lucide-react";

type Opp = {
  id: string;
  service_type: string | null;
  service_date: string | null;
  amount: number | null;
  status: string | null;
  move_type: string | null;
  branch_id: string | null;
  origin_json: Record<string, unknown> | null;
  destination_json: Record<string, unknown> | null;
};

type Estimate = {
  id: string;
  opportunity_id: string | null;
  amount: number;
  subtotal: number;
  sales_tax: number;
  discounts: number;
  charges_json: Array<Record<string, unknown>> | null;
  estimate_type: string;
  estimate_number: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  declined_at: string | null;
  deposit_amount: number;
  deposit_paid_at: string | null;
  created_at: string;
  auto_generated?: boolean;
  pricing_mode?: "local" | "long_distance" | null;
};

/**
 * Estimate tab shown on the customer detail page. Three sections:
 *   1. Inventory — room-based editor tied to the first opportunity
 *   2. Create new estimate (with tariff-engine drafting)
 *   3. Existing estimates list with Send/Download/Deposit actions
 */
export function EstimateTab({
  customerId,
  opportunities,
}: {
  customerId: string;
  opportunities: Opp[];
}) {
  const primaryOpp = opportunities[0];
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [activeEstimateId, setActiveEstimateId] = useState<string | null>(null);
  const [showDeposit, setShowDeposit] = useState<string | null>(null);
  const [sendDialogFor, setSendDialogFor] = useState<string | null>(null);
  const [customerContact, setCustomerContact] = useState<{ email: string; phone: string }>({
    email: "",
    phone: "",
  });

  async function reloadEstimates() {
    if (!primaryOpp) return;
    setLoading(true);
    const j = await fetch(`/api/estimates?opportunity_id=${primaryOpp.id}`).then((r) => r.json());
    setEstimates(j.estimates ?? []);
    setLoading(false);
  }

  useEffect(() => {
    reloadEstimates();
  }, [primaryOpp?.id]);

  // Pre-fetch the customer's email/phone once so the SendEstimateDialog opens
  // with the recipient fields pre-filled.
  useEffect(() => {
    if (!customerId) return;
    fetch(`/api/customers/${customerId}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.customer) {
          setCustomerContact({
            email: (j.customer.customer_email as string) ?? "",
            phone: (j.customer.customer_phone as string) ?? "",
          });
        }
      })
      .catch(() => {
        /* non-fatal */
      });
  }, [customerId]);

  // Latest draft (unsent, unsigned) estimate. Used by the header quick-action.
  // When multiple drafts exist, showing the estimate number in the label avoids
  // the "which one will this send?" ambiguity the reviewer flagged.
  const drafts = estimates.filter((e) => !e.sent_at && !e.accepted_at);
  const latestDraft = drafts[0];
  const draftLabel = latestDraft
    ? drafts.length === 1
      ? "Send latest draft"
      : `Send #${latestDraft.estimate_number ?? latestDraft.id.slice(0, 8).toUpperCase()}`
    : null;

  if (!primaryOpp) {
    return (
      <EmptyState
        title="No opportunity yet"
        description="Create an opportunity from the Sales tab before drafting an estimate."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Inventory */}
      <Section title="Inventory">
        <InventoryEditor opportunityId={primaryOpp.id} />
      </Section>

      {/* Send-estimate dialog (opened from row button OR header quick-action) */}
      <SendEstimateDialog
        open={Boolean(sendDialogFor)}
        estimateId={sendDialogFor ?? ""}
        defaultEmail={customerContact.email}
        defaultPhone={customerContact.phone}
        onClose={() => setSendDialogFor(null)}
        onSent={reloadEstimates}
      />

      {/* Estimates */}
      <Section
        title="Estimates"
        action={
          <div className="flex gap-2">
            {latestDraft ? (
              <Button
                variant="secondary"
                size="md"
                icon={<Send className="w-3 h-3" />}
                onClick={() => setSendDialogFor(latestDraft.id)}
                title={drafts.length > 1 ? `${drafts.length} drafts — sends the most recent` : undefined}
              >
                {draftLabel}
              </Button>
            ) : null}
            <button
              onClick={() => setShowNew(!showNew)}
              className="flex items-center gap-1 text-sm bg-accent text-white px-3 py-1.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              <Plus className="w-3 h-3" /> New Estimate
            </button>
          </div>
        }
      >
        {showNew && (
          <NewEstimateForm
            opportunity={primaryOpp}
            onCreated={() => {
              setShowNew(false);
              reloadEstimates();
            }}
          />
        )}

        {loading && <div className="text-sm text-muted-foreground mt-2">Loading…</div>}

        {!loading && estimates.length === 0 && (
          <div className="mt-2">
            <EmptyState
              icon={<FileText className="w-6 h-6" />}
              title="No estimates drafted"
              description="Create your first estimate using the tariff engine or a manual line-item entry."
              action={
                <Button onClick={() => setShowNew(true)} icon={<Plus className="w-3 h-3" />}>
                  New Estimate
                </Button>
              }
            />
          </div>
        )}

        {!loading && estimates.length > 0 && (
          <div className="space-y-2 mt-3">
            {estimates.map((e) => (
              <EstimateRow
                key={e.id}
                estimate={e}
                active={activeEstimateId === e.id}
                onToggle={() => setActiveEstimateId(activeEstimateId === e.id ? null : e.id)}
                customerId={customerId}
                showDeposit={showDeposit === e.id}
                setShowDeposit={(s) => setShowDeposit(s ? e.id : null)}
                onChange={reloadEstimates}
                onOpenSendDialog={setSendDialogFor}
              />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function StatusBadge({ estimate }: { estimate: Estimate }) {
  if (estimate.accepted_at) {
    return <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded">Accepted</span>;
  }
  if (estimate.declined_at) {
    return <span className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded">Declined</span>;
  }
  if (estimate.sent_at) {
    return <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">Sent</span>;
  }
  return <span className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded">Draft</span>;
}

function EstimateRow({
  estimate,
  active,
  onToggle,
  customerId,
  showDeposit,
  setShowDeposit,
  onChange,
  onOpenSendDialog,
}: {
  estimate: Estimate;
  active: boolean;
  onToggle: () => void;
  customerId: string;
  showDeposit: boolean;
  setShowDeposit: (s: boolean) => void;
  onChange: () => void;
  onOpenSendDialog: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  // Only drafts are editable. Sent estimates are locked to prevent the
  // "bait and switch" risk (customer sees $X in email, vendor edits to $Y,
  // customer signs $Y). To re-quote, the rep must duplicate and start fresh.
  const canEdit = !estimate.accepted_at && !estimate.declined_at && !estimate.sent_at;

  return (
    <div className="border border-border rounded-md overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-accent/5 text-left"
      >
        <div className="flex items-center gap-3">
          <StatusBadge estimate={estimate} />
          <span className="text-sm font-mono">
            #{estimate.estimate_number ?? estimate.id.slice(0, 8).toUpperCase()}
          </span>
          <span className="text-xs text-muted-foreground">
            {estimate.estimate_type.replace("_", " ")}
          </span>
          {estimate.auto_generated && (
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-100 text-purple-800"
              title="Auto-drafted by the estimator from historical comparable moves. Review before sending."
            >
              AUTO
              {estimate.pricing_mode === "long_distance" ? " · LD" : ""}
            </span>
          )}
        </div>
        <div className="text-right">
          <div className="text-sm font-semibold">${estimate.amount.toFixed(2)}</div>
          <div className="text-xs text-muted-foreground">{estimate.created_at.slice(0, 10)}</div>
        </div>
      </button>

      {active && (
        <div className="px-3 py-3 border-t border-border bg-accent/5 space-y-2 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-muted-foreground">Subtotal</div>
              <div className="font-mono">${estimate.subtotal.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Sales tax</div>
              <div className="font-mono">${estimate.sales_tax.toFixed(2)}</div>
            </div>
            {estimate.deposit_amount > 0 && (
              <div>
                <div className="text-muted-foreground">Deposit due</div>
                <div className="font-mono">${estimate.deposit_amount.toFixed(2)}</div>
              </div>
            )}
            {estimate.deposit_paid_at && (
              <div>
                <div className="text-muted-foreground">Deposit paid</div>
                <div>{estimate.deposit_paid_at.slice(0, 10)}</div>
              </div>
            )}
          </div>

          {estimate.auto_generated && (
            <AutoEstimateExplainer estimateId={estimate.id} />
          )}

          <div className="flex gap-2 pt-2">
            <a
              href={`/api/estimates/${estimate.id}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-2 py-1 rounded border border-border hover:bg-accent/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              <FileText className="w-3 h-3" /> PDF
            </a>
            <a
              href={`/estimate/${estimate.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-2 py-1 rounded border border-border hover:bg-accent/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              <ExternalLink className="w-3 h-3" /> Customer view
            </a>
            {canEdit && !editing && (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1 px-2 py-1 rounded border border-border hover:bg-accent/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                title="Edit line items"
              >
                <Pencil className="w-3 h-3" /> Edit
              </button>
            )}
            {!estimate.sent_at && !estimate.accepted_at && (
              <button
                onClick={() => onOpenSendDialog(estimate.id)}
                className="flex items-center gap-1 px-2 py-1 rounded bg-accent text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
              >
                <Send className="w-3 h-3" /> Send
              </button>
            )}
            {estimate.sent_at && !estimate.accepted_at && (
              <button
                onClick={() => onOpenSendDialog(estimate.id)}
                className="flex items-center gap-1 px-2 py-1 rounded border border-border hover:bg-accent/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                title="Resend to customer"
              >
                <Send className="w-3 h-3" /> Resend
              </button>
            )}
            {estimate.deposit_amount > 0 && !estimate.deposit_paid_at && (
              <button
                onClick={() => setShowDeposit(!showDeposit)}
                className="flex items-center gap-1 px-2 py-1 rounded border border-border hover:bg-background"
              >
                <Check className="w-3 h-3" /> Record deposit
              </button>
            )}
          </div>

          {showDeposit && (
            <div className="mt-3">
              <DepositCollector
                estimateId={estimate.id}
                customerId={customerId}
                defaultAmount={estimate.deposit_amount}
                onPaid={() => {
                  setShowDeposit(false);
                  onChange();
                }}
              />
            </div>
          )}

          {editing && canEdit && (
            <div className="mt-3">
              <LineItemEditor
                estimateId={estimate.id}
                initialItems={coerceLineItems(estimate.charges_json)}
                initialDiscounts={Number(estimate.discounts) || 0}
                initialSalesTax={Number(estimate.sales_tax) || 0}
                onSaved={() => {
                  setEditing(false);
                  onChange();
                }}
                onCancel={() => setEditing(false)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NewEstimateForm({ opportunity, onCreated }: { opportunity: Opp; onCreated: () => void }) {
  const [type, setType] = useState("non_binding");
  const [hours, setHours] = useState(4);
  const [crew, setCrew] = useState(3);
  const [trucks, setTrucks] = useState(1);
  const [serviceDate, setServiceDate] = useState(
    opportunity.service_date ?? new Date().toISOString().slice(0, 10),
  );
  const [distance, setDistance] = useState(0);
  const [floorOrigin, setFloorOrigin] = useState(1);
  const [floorDest, setFloorDest] = useState(1);
  const [weight, setWeight] = useState(5000);
  const [taxRate, setTaxRate] = useState(0.089);
  const [deposit, setDeposit] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    setErr("");
    setSubmitting(true);
    const res = await fetch("/api/estimates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        opportunity_id: opportunity.id,
        estimate_type: type,
        deposit_amount: deposit,
        estimate_input: {
          move_type: opportunity.move_type ?? opportunity.service_type ?? "local_move",
          service_date: serviceDate,
          estimated_hours: hours,
          crew_size: crew,
          truck_count: trucks,
          distance_miles: distance,
          floor_origin: floorOrigin,
          floor_destination: floorDest,
          weight_lbs: weight,
          valuation_choice: "Released Value",
        },
        options: { tax_rate: taxRate, estimate_type: type },
      }),
    });
    const j = await res.json();
    setSubmitting(false);
    if (j.estimate) onCreated();
    else setErr(j.error ?? "Failed");
  }

  return (
    <div className="border border-border rounded-md p-3 bg-accent/5 mb-3 space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Field label="Estimate type">
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="text-xs border border-border rounded-md px-2 py-1 bg-background w-full"
          >
            <option value="non_binding">Non-binding</option>
            <option value="binding">Binding</option>
            <option value="binding_nte">Binding not-to-exceed</option>
            <option value="hourly">Hourly</option>
            <option value="flat_rate">Flat rate</option>
          </select>
        </Field>
        <Field label="Hours">
          <input
            type="number"
            step="0.5"
            value={hours}
            onChange={(e) => setHours(parseFloat(e.target.value) || 0)}
            className="text-xs border border-border rounded-md px-2 py-1 bg-background w-full"
          />
        </Field>
        <Field label="Crew">
          <input
            type="number"
            value={crew}
            onChange={(e) => setCrew(parseInt(e.target.value) || 0)}
            className="text-xs border border-border rounded-md px-2 py-1 bg-background w-full"
          />
        </Field>
        <Field label="Trucks">
          <input
            type="number"
            value={trucks}
            onChange={(e) => setTrucks(parseInt(e.target.value) || 0)}
            className="text-xs border border-border rounded-md px-2 py-1 bg-background w-full"
          />
        </Field>
        <Field label="Distance (mi)">
          <input
            type="number"
            value={distance}
            onChange={(e) => setDistance(parseFloat(e.target.value) || 0)}
            className="text-xs border border-border rounded-md px-2 py-1 bg-background w-full"
          />
        </Field>
        <Field label="Weight (lbs)">
          <input
            type="number"
            value={weight}
            onChange={(e) => setWeight(parseFloat(e.target.value) || 0)}
            className="text-xs border border-border rounded-md px-2 py-1 bg-background w-full"
          />
        </Field>
        <Field label="Floor origin">
          <input
            type="number"
            min="1"
            value={floorOrigin}
            onChange={(e) => setFloorOrigin(parseInt(e.target.value) || 1)}
            className="text-xs border border-border rounded-md px-2 py-1 bg-background w-full"
          />
        </Field>
        <Field label="Floor dest">
          <input
            type="number"
            min="1"
            value={floorDest}
            onChange={(e) => setFloorDest(parseInt(e.target.value) || 1)}
            className="text-xs border border-border rounded-md px-2 py-1 bg-background w-full"
          />
        </Field>
        <Field label="Service date">
          <input
            type="date"
            value={serviceDate}
            onChange={(e) => setServiceDate(e.target.value)}
            className="text-xs border border-border rounded-md px-2 py-1 bg-background w-full"
          />
        </Field>
        <Field label="Tax rate">
          <input
            type="number"
            step="0.001"
            value={taxRate}
            onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
            className="text-xs border border-border rounded-md px-2 py-1 bg-background w-full"
          />
        </Field>
        <Field label="Deposit required">
          <input
            type="number"
            step="0.01"
            value={deposit}
            onChange={(e) => setDeposit(parseFloat(e.target.value) || 0)}
            className="text-xs border border-border rounded-md px-2 py-1 bg-background w-full"
          />
        </Field>
      </div>
      {err && <div className="text-xs text-red-500">{err}</div>}
      <button
        onClick={submit}
        disabled={submitting}
        className="flex items-center gap-1 text-sm bg-accent text-white px-4 py-1.5 rounded-md disabled:opacity-60"
      >
        {submitting ? "Calculating…" : "Create estimate"}
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wide text-muted-foreground block mb-0.5">{label}</label>
      {children}
    </div>
  );
}

/**
 * Narrow arbitrary `charges_json` JSONB into strictly-typed LineItem[].
 * Legacy rows may have string-typed numerics or missing labels; this helper
 * coerces numerics via Number() and drops rows that can't be salvaged.
 * Replaces the earlier `as unknown as LineItem[]` double-cast.
 */
function coerceLineItems(raw: Array<Record<string, unknown>> | null): LineItem[] {
  if (!Array.isArray(raw)) return [];
  const out: LineItem[] = [];
  for (const li of raw) {
    if (!li || typeof li !== "object") continue;
    const label = typeof li.label === "string" ? li.label : "";
    if (!label.trim()) continue;
    const subtotal = Number(li.subtotal);
    if (!Number.isFinite(subtotal)) continue;
    const item: LineItem = { label, subtotal };
    if (typeof li.kind === "string") {
      const k = li.kind as LineItem["kind"];
      if (k === "labor" || k === "truck" || k === "material" || k === "packing" || k === "travel" || k === "flat" || k === "mileage") {
        item.kind = k;
      }
    }
    if (li.rate !== undefined && li.rate !== null) {
      const n = Number(li.rate);
      if (Number.isFinite(n)) item.rate = n;
    }
    if (li.quantity !== undefined && li.quantity !== null) {
      const n = Number(li.quantity);
      if (Number.isFinite(n)) item.quantity = n;
    }
    if (typeof li.unit === "string") {
      const u = li.unit as LineItem["unit"];
      if (u === "hour" || u === "mile" || u === "cwt" || u === "flat" || u === "each" || u === "day") {
        item.unit = u;
      }
    }
    if (typeof li.rate_id === "string") item.rate_id = li.rate_id;
    out.push(item);
  }
  return out;
}

/**
 * Renders inside the expanded estimate row when `estimate.auto_generated` is
 * true. Lazy-fetches the estimator_predictions row tied to this estimate and
 * surfaces the human-readable explanation array + comparable sample count +
 * confidence + margin status so agents can audit the auto-draft before
 * sending. Silent on fetch error (non-critical to the rest of the UI).
 */
type PredictionPayload = {
  id: string;
  brand_code: string;
  pricing_mode: "local" | "long_distance";
  comparable_sample_n: number | null;
  confidence: number;
  margin_status: "ok" | "warn" | "block";
  margin_pct: number;
  driveway_review_required: boolean;
  driveway_flags: Record<string, boolean>;
  deadhead_skipped: boolean;
  explanation: string[];
  estimate_input: Record<string, unknown>;
  materials: Array<{ sku: string; qty: number; unit_price?: number }>;
  valuation: { recommended: string; declared_value?: number } | null;
  inventory_totals: {
    total_cu_ft?: number;
    total_weight_lb?: number;
    specialty_items?: string[];
    oversized_tvs?: string[];
  } | null;
};

function AutoEstimateExplainer({ estimateId }: { estimateId: string }) {
  const [pred, setPred] = useState<PredictionPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/estimates/${estimateId}/prediction`).then((r) => r.json());
        if (!cancelled) setPred(r.prediction ?? null);
      } catch {
        /* silent */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [estimateId]);

  if (loading || !pred) return null;

  const confidencePct = Math.round(pred.confidence * 100);
  const marginColor =
    pred.margin_status === "ok"
      ? "text-green-700"
      : pred.margin_status === "warn"
        ? "text-amber-700"
        : "text-red-700";
  const flagLabels = Object.entries(pred.driveway_flags)
    .filter(([, v]) => v)
    .map(([k]) => k);

  return (
    <div className="border border-purple-200 rounded-md bg-purple-50/50">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-purple-50"
      >
        <span className="flex items-center gap-2 text-xs font-medium text-purple-900">
          <Sparkles className="w-3 h-3" />
          Why these numbers?
        </span>
        <span className="flex items-center gap-2 text-[10px] text-purple-700">
          <span>{pred.pricing_mode === "long_distance" ? "long-distance" : "local"}</span>
          <span>·</span>
          <span>confidence {confidencePct}%</span>
          <span>·</span>
          <span>{pred.comparable_sample_n ?? 0} comparable jobs</span>
          <span>·</span>
          <span className={marginColor}>margin {pred.margin_pct.toFixed(1)}%</span>
        </span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-purple-200 pt-2 text-[11px] text-purple-950">
          {pred.margin_status === "block" && (
            <div className="flex items-start gap-1 rounded bg-red-100 px-2 py-1 text-red-800">
              <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
              <span>
                Margin blocked — this estimate was <strong>not</strong> auto-sent. Agent review required before quoting the customer.
              </span>
            </div>
          )}
          {pred.driveway_review_required && (
            <div className="flex items-start gap-1 rounded bg-amber-100 px-2 py-1 text-amber-900">
              <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
              <span>
                Driveway flags: {flagLabels.join(", ") || "see StreetView"}. Shuttle fee added; please confirm before sending.
              </span>
            </div>
          )}
          {pred.deadhead_skipped && (
            <div className="flex items-start gap-1 rounded bg-amber-100 px-2 py-1 text-amber-900">
              <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
              <span>
                No yards configured for this brand — deadhead fee skipped. Add dispatch yards in <a href="/settings/shops" className="underline">Settings → Dispatch Yards</a>.
              </span>
            </div>
          )}

          <div>
            <div className="font-semibold mb-1">Reasoning trace</div>
            <ul className="space-y-0.5 list-disc list-inside">
              {pred.explanation.map((line, i) => (
                <li key={i} className="text-purple-900">{line}</li>
              ))}
            </ul>
          </div>

          {pred.inventory_totals && (
            <div className="grid grid-cols-4 gap-2 pt-1">
              {pred.inventory_totals.total_cu_ft !== undefined && (
                <ExplainerStat label="Cubic feet" value={pred.inventory_totals.total_cu_ft.toLocaleString()} />
              )}
              {pred.inventory_totals.total_weight_lb !== undefined && (
                <ExplainerStat label="Billable lb" value={pred.inventory_totals.total_weight_lb.toLocaleString()} />
              )}
              {pred.inventory_totals.specialty_items && pred.inventory_totals.specialty_items.length > 0 && (
                <ExplainerStat
                  label="Specialty items"
                  value={pred.inventory_totals.specialty_items.join(", ")}
                />
              )}
              {pred.inventory_totals.oversized_tvs && pred.inventory_totals.oversized_tvs.length > 0 && (
                <ExplainerStat
                  label="Oversized TVs"
                  value={pred.inventory_totals.oversized_tvs.length.toString()}
                />
              )}
            </div>
          )}

          {pred.materials.length > 0 && (
            <div>
              <div className="font-semibold mb-1">Recommended materials</div>
              <ul className="list-disc list-inside">
                {pred.materials.map((m) => (
                  <li key={m.sku}>
                    {m.sku.replace(/_/g, " ")}: {m.qty}
                    {m.unit_price ? ` × $${m.unit_price.toFixed(2)}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {pred.valuation && (
            <div>
              <div className="font-semibold mb-1">Valuation default (per 15-C Item 90)</div>
              <div>
                {pred.valuation.recommended === "full" ? "Replacement Cost" : "Basic ($0.72/lb)"}
                {pred.valuation.declared_value
                  ? ` — declared value $${pred.valuation.declared_value.toLocaleString()}`
                  : ""}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ExplainerStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] text-purple-700">{label}</div>
      <div className="font-mono">{value}</div>
    </div>
  );
}
