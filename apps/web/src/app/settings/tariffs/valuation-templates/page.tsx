"use client";

export default function ValuationTemplatesPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Valuation Templates</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Reusable valuation/insurance options. Add a valuation directly to a tariff in the{" "}
          <a href="/settings/tariffs/library" className="underline">Tariff Library</a>.
        </p>
      </div>
      <div className="text-sm text-muted-foreground border border-dashed border-border rounded-md p-8 text-center">
        Standalone templates ship in v1.2. For now, define valuations on each tariff individually.
      </div>
    </div>
  );
}
