"use client";

import { SettingsListEditor } from "@/components/SettingsListEditor";

/**
 * /settings/estimates/service-types — the catalog of service types users
 * can attach to an estimate, opportunity, or job.
 *
 * Values here power:
 *   - the Service Type dropdown on the estimate / opportunity forms
 *   - the `service_type` column on tariff assignments (so "Local Move"
 *     tariff only applies to local opportunities, etc.)
 *
 * Stored in the generic `settings` table under category="estimates",
 * key="service_types" — the API route at /api/settings/[category]
 * handles org scoping + upsert semantics.
 */
const DEFAULTS = [
  { value: "local_move", label: "Local Move" },
  { value: "long_distance", label: "Long Distance" },
  { value: "interstate", label: "Interstate" },
  { value: "international", label: "International" },
  { value: "commercial", label: "Commercial" },
  { value: "office", label: "Office Move" },
  { value: "labor_only", label: "Labor Only" },
  { value: "packing_only", label: "Packing Only" },
  { value: "loading_only", label: "Loading Only" },
  { value: "unloading_only", label: "Unloading Only" },
  { value: "storage_in_transit", label: "Storage in Transit" },
  { value: "junk_removal", label: "Junk Removal" },
];

export default function ServiceTypesPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Service Types</h1>
        <p className="text-sm text-muted mt-1">
          The move / service categories you sell. These values drive the Service
          Type dropdown on opportunities and estimates, and feed tariff
          assignment rules (so a Long Distance tariff only applies to long-
          distance opportunities).
        </p>
      </div>
      <SettingsListEditor
        category="estimates"
        settingKey="service_types"
        defaults={DEFAULTS}
        itemNoun="service type"
      />
    </div>
  );
}
