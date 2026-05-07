// US Census Geocoder — free, no key, no quota
export async function geocodeUSAddress(
  address: string
): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encodeURIComponent(
      address
    )}&benchmark=Public_AR_Current&format=json`;
    const r = await fetch(url);
    const j = (await r.json()) as {
      result?: { addressMatches?: Array<{ coordinates: { y: number; x: number } }> };
    };
    const match = j.result?.addressMatches?.[0];
    if (!match) return null;
    return { lat: match.coordinates.y, lng: match.coordinates.x };
  } catch {
    return null;
  }
}
