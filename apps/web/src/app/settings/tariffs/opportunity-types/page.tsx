"use client";

import { SettingsListEditor } from "@/components/SettingsListEditor";

const DEFAULTS = [
  { value: "residential", label: "Residential" },
  { value: "commercial", label: "Commercial" },
  { value: "office", label: "Office" },
  { value: "warehouse", label: "Warehouse" },
  { value: "labor_only", label: "Labor only" },
  { value: "packing_only", label: "Packing only" },
];

export default function OpportunityTypesPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Opportunity Types</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Categorize opportunities (residential, commercial, etc.). Used in tariff assignment rules.
        </p>
      </div>
      <SettingsListEditor category="tariffs" settingKey="opportunity_types" defaults={DEFAULTS} />
    </div>
  );
}
