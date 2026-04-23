import type { Season } from "./types";

/** Seasonal bucket used by move_size_stats. Matches the SQL expression in
 *  refresh_estimator_stats() so app-side and DB-side lookups line up. */
export function seasonForDate(isoDate: string): Season {
  const month = new Date(`${isoDate}T00:00:00Z`).getUTCMonth() + 1;
  if (month === 12 || month === 1 || month === 2) return "winter";
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  return "fall";
}
