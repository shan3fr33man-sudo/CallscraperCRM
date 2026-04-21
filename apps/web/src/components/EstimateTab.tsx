"use client";
import { useEffect, useState } from "react";
import { Plus, Send, FileText, Check, ExternalLink } from "lucide-react";
import { InventoryEditor } from "@/components/InventoryEditor";
import { DepositCollector } from "@/components/DepositCollector";

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
  estimate_type: string;
  estimate_number: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  declined_at: string | null;
  deposit_amount: number;
  deposit_paid_at: string | null;
  created_at: string;
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

  if (!primaryOpp) {
    return (
      <div className="text-sm text-muted-foreground border border-dashed border-border rounded-md p-6 text-center">
        No opportunity yet. Create one from the Sales tab first.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Inventory */}
      <Section title="Inventory">
        <InventoryEditor opportunityId={primaryOpp.id} />
      </Section>

      {/* Estimates */}
      <Section
        title="Estimates"
        action={
          <button
            onClick={() => setShowNew(!showNew)}
            className="flex items-center gap-1 text-sm bg-accent text-white px-3 py-1.5 rounded-md"
          >
            <Plus className="w-3 h-3" /> New Estimate
          </button>
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
          <div className="text-sm text-muted-foreground border border-dashed border-border rounded-md p-6 text-center mt-2">
            No estimates drafted. Click &quot;New Estimate&quot; to create one.
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
}: {
  estimate: Estimate;
  active: boolean;
  onToggle: () => void;
  customerId: string;
  showDeposit: boolean;
  setShowDeposit: (s: boolean) => void;
  onChange: () => void;
}) {
  const [sending, setSending] = useState(false);

  async function send() {
    setSending(true);
    await fetch(`/api/estimates/${estimate.id}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel: "email" }),
    });
    setSending(false);
    onChange();
  }

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

          <div className="flex gap-2 pt-2">
            <a
              href={`/api/estimates/${estimate.id}/pdf`}
              target="_blank"
              className="flex items-center gap-1 px-2 py-1 rounded border border-border hover:bg-background"
            >
              <FileText className="w-3 h-3" /> PDF
            </a>
            <a
              href={`/estimate/${estimate.id}`}
              target="_blank"
              className="flex items-center gap-1 px-2 py-1 rounded border border-border hover:bg-background"
            >
              <ExternalLink className="w-3 h-3" /> Customer view
            </a>
            {!estimate.sent_at && (
              <button
                onClick={send}
                disabled={sending}
                className="flex items-center gap-1 px-2 py-1 rounded bg-accent text-white disabled:opacity-60"
              >
                <Send className="w-3 h-3" /> {sending ? "Sending…" : "Send"}
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
