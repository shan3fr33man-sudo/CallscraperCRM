type Waypoint = { lat: number; lng: number; name?: string };

export function buildGoogleMapsDirectionsUrl(
  origin: Waypoint | string,
  destination: Waypoint | string,
  waypoints: Waypoint[] = []
): string {
  const fmt = (w: Waypoint | string) =>
    typeof w === 'string' ? encodeURIComponent(w) : `${w.lat},${w.lng}`;

  const params = new URLSearchParams({
    api: '1',
    origin: fmt(origin),
    destination: fmt(destination),
    travelmode: 'driving',
  });

  if (waypoints.length) {
    params.set('waypoints', waypoints.map((w) => fmt(w)).join('|'));
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function buildGoogleMapsPlaceUrl(name: string, placeId?: string): string {
  const q = encodeURIComponent(name);
  return placeId
    ? `https://www.google.com/maps/search/?api=1&query=${q}&query_place_id=${placeId}`
    : `https://www.google.com/maps/search/?api=1&query=${q}`;
}
