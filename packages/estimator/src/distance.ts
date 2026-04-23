import type { DistanceBucket } from "./types";

/** Distance bucket for move_size_stats. Matches the SQL expression in
 *  refresh_estimator_stats() so app-side and DB-side lookups line up. */
export function distanceBucket(miles: number | null | undefined): DistanceBucket {
  if (miles === null || miles === undefined) return "unknown";
  if (miles < 25) return "local_under_25mi";
  if (miles < 100) return "25_100mi";
  if (miles < 500) return "100_500mi";
  if (miles < 1500) return "500_1500mi";
  return "1500_plus_mi";
}

/** Driving miles between two addresses, Google Distance Matrix API. */
export interface DistanceLookup {
  origin: string;
  dest: string;
  miles: number;
  durationSeconds: number;
  fromCache: boolean;
}

export interface DistanceProvider {
  lookup(origin: string, dest: string): Promise<DistanceLookup>;
}

/** Default provider: Google Distance Matrix with 30-day cache on the
 *  distance_cache table (cache read/write handled by caller). This function
 *  does the network call only; the API route layer persists to the cache. */
export class GoogleDistanceMatrix implements DistanceProvider {
  constructor(private readonly apiKey: string) {
    if (!apiKey) throw new Error("GoogleDistanceMatrix: apiKey required");
  }

  async lookup(origin: string, dest: string): Promise<DistanceLookup> {
    const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
    url.searchParams.set("origins", origin);
    url.searchParams.set("destinations", dest);
    url.searchParams.set("units", "imperial");
    url.searchParams.set("key", this.apiKey);

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`distance_matrix ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as {
      status: string;
      rows?: { elements: { status: string; distance?: { value: number }; duration?: { value: number } }[] }[];
    };
    if (json.status !== "OK") throw new Error(`distance_matrix status: ${json.status}`);
    const el = json.rows?.[0]?.elements?.[0];
    if (!el || el.status !== "OK" || !el.distance || !el.duration) {
      throw new Error(`distance_matrix element status: ${el?.status ?? "missing"}`);
    }
    return {
      origin,
      dest,
      miles: el.distance.value / 1609.344,
      durationSeconds: el.duration.value,
      fromCache: false,
    };
  }
}

/** Haversine distance — fallback when Google API is unavailable. Takes
 *  lat/lng pairs; caller geocodes first. Driving-miles will differ by ~20%. */
export function haversineMiles(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
