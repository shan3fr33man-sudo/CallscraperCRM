"use client";
import { useEffect, useState } from "react";
import { TopBar } from "@/components/TopBar";
import { CalendarView, type CalendarFilters } from "@/components/CalendarView";

const JOB_TYPES = [
  { value: "local", label: "Local" },
  { value: "long_distance", label: "Long Distance" },
  { value: "interstate", label: "Interstate" },
  { value: "labor_only", label: "Labor Only" },
];

const DISTANCES = [
  { value: "local", label: "Local (<50mi)" },
  { value: "regional", label: "Regional (50-150mi)" },
  { value: "long", label: "Long (150mi+)" },
];

type Branch = { id: string; name: string };

export default function JobCalendarPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [filters, setFilters] = useState<CalendarFilters>({});
  const [jobType, setJobType] = useState<string>("");
  const [distance, setDistance] = useState<string>("");

  useEffect(() => {
    fetch("/api/branches").then((r) => r.json()).then((j) => setBranches(j.branches ?? []));
  }, []);

  // jobType and distance are display-only filters until jobs table joins land in Phase E
  void jobType; void distance;

  return (
    <div>
      <TopBar title="Job Calendar" />
      <div className="p-5">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <select value={filters.branch_id ?? ""} onChange={(e) => setFilters({ ...filters, branch_id: e.target.value || undefined })} className="text-xs border border-border rounded-md px-2 py-1.5 bg-background">
            <option value="">All branches</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <div className="flex items-center gap-1 flex-wrap">
            <button onClick={() => setJobType("")} className={`text-xs px-2 py-1 rounded-md border ${!jobType ? "bg-accent text-white border-accent" : "border-border"}`}>All job types</button>
            {JOB_TYPES.map((t) => (
              <button key={t.value} onClick={() => setJobType(t.value)} className={`text-xs px-2 py-1 rounded-md border ${jobType === t.value ? "bg-accent text-white border-accent" : "border-border"}`}>{t.label}</button>
            ))}
          </div>
          <select value={distance} onChange={(e) => setDistance(e.target.value)} className="text-xs border border-border rounded-md px-2 py-1.5 bg-background">
            <option value="">All distances</option>
            {DISTANCES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>
        <CalendarView kind="job" filters={filters} />
      </div>
    </div>
  );
}
