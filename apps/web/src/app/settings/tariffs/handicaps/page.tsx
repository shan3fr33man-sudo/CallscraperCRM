"use client";

export default function HandicapsPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Handicaps</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Multipliers applied to subtotals when conditions match (e.g. long-distance moves). Define handicaps directly on each tariff in the{" "}
          <a href="/settings/tariffs/library" className="underline">Tariff Library</a>.
        </p>
      </div>
      <div className="text-sm text-muted-foreground border border-dashed border-border rounded-md p-8 text-center">
        Standalone handicap library ships in v1.2. For now, define handicaps on each tariff individually.
      </div>
    </div>
  );
}
