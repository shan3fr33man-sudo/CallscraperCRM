"use client";
import { useEffect, useState } from "react";
import { Calculator, Loader2 } from "lucide-react";

type PreviewResult = {
  line_items: Array<{ label: string; kind: string; rate: number; quantity: number; unit: string; subtotal: number }>;
  subtotal: number;
  modifiers_applied: Array<{ label: string; kind: string; amount: number; applied_to: string }>;
  modifiers_total: number;
  handicaps_applied: Array<{ name: string; multiplier: number; amount: number }>;
  handicaps_total: number;
  valuation_charge: number;
  pre_discount_total: number;
  discount: number;
  taxable_amount: number;
  sales_tax: number;
  total: number;
  trace: string[];
};

export function PricingPreview({ tariffId }: { tariffId: string }) {
  const [hours, setHours] = useState(4);
  const [crew, setCrew] = useState(3);
  const [trucks, setTrucks] = useState(1);
  const [serviceDate, setServiceDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  });
  const [floorOrigin, setFloorOrigin] = useState(1);
  const [floorDest, setFloorDest] = useState(1);
  const [longCarry, setLongCarry] = useState(0);
  const [distance, setDistance] = useState(0);
  const [taxRate, setTaxRate] = useState(0.089);
  const [valChoice, setValChoice] = useState("Released Value");
  const [weight, setWeight] = useState(5000);

  const [result, setResult] = useState<PreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/tariffs/${tariffId}/preview`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            input: {
              move_type: "local_move",
              service_date: serviceDate,
              estimated_hours: hours,
              crew_size: crew,
              truck_count: trucks,
              floor_origin: floorOrigin,
              floor_destination: floorDest,
              long_carry_origin_ft: longCarry,
              distance_miles: distance,
              weight_lbs: weight,
              valuation_choice: valChoice,
            },
            options: { tax_rate: taxRate, estimate_type: "non_binding" },
          }),
        });
        const j = await res.json();
        if (!cancelled) {
          if (j.result) setResult(j.result);
          else setError(j.error ?? "Preview failed");
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message);
          setLoading(false);
        }
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [tariffId, hours, crew, trucks, serviceDate, floorOrigin, floorDest, longCarry, distance, taxRate, valChoice, weight]);

  return (
    <div className="border border-border rounded-md p-4 bg-accent/5">
      <div className="flex items-center gap-2 mb-3">
        <Calculator className="w-4 h-4 text-accent" />
        <h3 className="text-sm font-semibold">Live Preview</h3>
        {loading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs mb-4">
        <Field label="Hours" value={hours} setValue={setHours} step={0.5} />
        <Field label="Crew size" value={crew} setValue={setCrew} step={1} />
        <Field label="Trucks" value={trucks} setValue={setTrucks} step={1} />
        <Field label="Distance (mi)" value={distance} setValue={setDistance} step={1} />
        <Field label="Floor origin" value={floorOrigin} setValue={setFloorOrigin} step={1} />
        <Field label="Floor dest" value={floorDest} setValue={setFloorDest} step={1} />
        <Field label="Long carry (ft)" value={longCarry} setValue={setLongCarry} step={5} />
        <Field label="Weight (lbs)" value={weight} setValue={setWeight} step={100} />
        <div>
          <label className="text-muted-foreground block mb-0.5">Service date</label>
          <input
            type="date"
            value={serviceDate}
            onChange={(e) => setServiceDate(e.target.value)}
            className="w-full text-xs border border-border rounded px-1.5 py-1 bg-background"
          />
        </div>
        <div>
          <label className="text-muted-foreground block mb-0.5">Tax rate</label>
          <input
            type="number"
            step="0.001"
            value={taxRate}
            onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
            className="w-full text-xs border border-border rounded px-1.5 py-1 bg-background"
          />
        </div>
        <div className="col-span-2">
          <label className="text-muted-foreground block mb-0.5">Valuation</label>
          <select
            value={valChoice}
            onChange={(e) => setValChoice(e.target.value)}
            className="w-full text-xs border border-border rounded px-1.5 py-1 bg-background"
          >
            <option value="Released Value">Released Value</option>
            <option value="Full Replacement">Full Replacement</option>
            <option value="">— None —</option>
          </select>
        </div>
      </div>

      {error && <div className="text-xs text-red-500 mb-2">{error}</div>}

      {result && (
        <div className="border-t border-border pt-3">
          <div className="space-y-1 text-xs mb-3">
            {result.line_items.map((li, i) => (
              <div key={i} className="flex justify-between">
                <span>
                  {li.label} ({li.quantity} {li.unit})
                </span>
                <span className="font-mono">${li.subtotal.toFixed(2)}</span>
              </div>
            ))}
          </div>
          <Row label="Subtotal" value={result.subtotal} />
          {result.modifiers_applied.map((m, i) => (
            <Row key={i} label={`+ ${m.label}`} value={m.amount} dim />
          ))}
          {result.modifiers_total > 0 && <Row label="Modifiers" value={result.modifiers_total} />}
          {result.handicaps_total !== 0 && <Row label="Handicaps" value={result.handicaps_total} />}
          {result.valuation_charge > 0 && <Row label="Valuation" value={result.valuation_charge} />}
          {result.discount > 0 && <Row label="Discount" value={-result.discount} />}
          {result.sales_tax > 0 && <Row label="Sales tax" value={result.sales_tax} />}
          <div className="border-t border-border mt-2 pt-2 flex justify-between text-sm font-semibold">
            <span>Total</span>
            <span className="font-mono">${result.total.toFixed(2)}</span>
          </div>
          {result.trace.length > 0 && (
            <details className="mt-3 text-xs">
              <summary className="cursor-pointer text-muted-foreground">Why this number</summary>
              <ul className="mt-1 space-y-0.5 pl-3">
                {result.trace.map((t, i) => (
                  <li key={i} className="text-muted-foreground">
                    {t}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  setValue,
  step,
}: {
  label: string;
  value: number;
  setValue: (n: number) => void;
  step: number;
}) {
  return (
    <div>
      <label className="text-muted-foreground block mb-0.5">{label}</label>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => setValue(parseFloat(e.target.value) || 0)}
        className="w-full text-xs border border-border rounded px-1.5 py-1 bg-background"
      />
    </div>
  );
}

function Row({ label, value, dim }: { label: string; value: number; dim?: boolean }) {
  return (
    <div className={`flex justify-between text-xs ${dim ? "text-muted-foreground pl-3" : ""}`}>
      <span>{label}</span>
      <span className="font-mono">${value.toFixed(2)}</span>
    </div>
  );
}
