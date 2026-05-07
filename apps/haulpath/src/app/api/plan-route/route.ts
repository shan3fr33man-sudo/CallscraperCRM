import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { geocodeUSAddress } from '@/lib/geocode'
import { buildGoogleMapsDirectionsUrl } from '@/lib/googleMapsUrl'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Simple distance estimation (rough approximation)
function estimateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959 // Earth's radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

// Estimate duration (roughly 1 hour per 60 miles)
function estimateDuration(miles: number): string {
  const hours = Math.round(miles / 60)
  if (hours < 2) return `${hours} hour`
  return `${hours} hours`
}

// Find stops within a reasonable distance from the route
async function findStopsNearRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  limit: number = 8
) {
  // Simple approach: find stops within a bounding box around origin and destination
  const minLat = Math.min(origin.lat, destination.lat) - 2
  const maxLat = Math.max(origin.lat, destination.lat) + 2
  const minLng = Math.min(origin.lng, destination.lng) - 2
  const maxLng = Math.max(origin.lng, destination.lng) + 2

  const { data: stops, error } = await supabase
    .from('truck_stops')
    .select('*')
    .gte('location', `POINT(${minLng} ${minLat})`)
    .lte('location', `POINT(${maxLng} ${maxLat})`)
    .limit(limit)

  if (error) {
    console.error('Error fetching stops:', error)
    return []
  }

  return (stops || []).map((stop) => ({
    id: stop.id,
    name: stop.name,
    brand: stop.brand,
    city: stop.city,
    state: stop.state,
    highway: stop.highway,
    exit_number: stop.exit_number,
    lat: stop.location?.coordinates[1] || 0,
    lng: stop.location?.coordinates[0] || 0,
    price: 3.2, // Placeholder - will be fetched from fuel_prices table in Phase 3
  }))
}

async function findHotelsNearRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  limit: number = 5
) {
  const minLat = Math.min(origin.lat, destination.lat) - 2
  const maxLat = Math.max(origin.lat, destination.lat) + 2
  const minLng = Math.min(origin.lng, destination.lng) - 2
  const maxLng = Math.max(origin.lng, destination.lng) + 2

  const { data: hotels, error } = await supabase
    .from('hotels')
    .select('*')
    .gte('location', `POINT(${minLng} ${minLat})`)
    .lte('location', `POINT(${maxLng} ${maxLat})`)
    .eq('has_truck_parking', true)
    .limit(limit)

  if (error) {
    console.error('Error fetching hotels:', error)
    return []
  }

  return (hotels || []).map((hotel) => ({
    id: hotel.id,
    name: hotel.name,
    city: hotel.city,
    state: hotel.state,
    lat: hotel.location?.coordinates[1] || 0,
    lng: hotel.location?.coordinates[0] || 0,
    nightly_rate_low: hotel.nightly_rate_low,
  }))
}

export async function POST(req: NextRequest) {
  try {
    const { from, to, includeHotels } = await req.json()

    if (!from || !to) {
      return NextResponse.json({ error: 'Missing from or to address' }, { status: 400 })
    }

    // Geocode addresses
    const origin = await geocodeUSAddress(from)
    const destination = await geocodeUSAddress(to)

    if (!origin || !destination) {
      return NextResponse.json(
        { error: 'Could not find one or both addresses. Please try again with more complete addresses.' },
        { status: 400 }
      )
    }

    // Find stops
    const stops = await findStopsNearRoute(origin, destination)

    // Find hotels if requested
    const hotels = includeHotels ? await findHotelsNearRoute(origin, destination) : []

    // Calculate distance and duration
    const distance = estimateDistance(origin.lat, origin.lng, destination.lat, destination.lng)
    const duration = estimateDuration(distance)

    // Build Google Maps URL with waypoints
    const waypointsForMap = stops.slice(0, 5).map((stop) => ({
      lat: stop.lat,
      lng: stop.lng,
      name: stop.name,
    }))
    const googleMapsUrl = buildGoogleMapsDirectionsUrl(origin, destination, waypointsForMap)

    return NextResponse.json({
      origin,
      destination,
      stops,
      hotels,
      googleMapsUrl,
      routeSummary: {
        distance: `~${Math.round(distance)} mi`,
        duration: `~${duration}`,
      },
    })
  } catch (error) {
    console.error('Error planning route:', error)
    return NextResponse.json({ error: 'Failed to plan route' }, { status: 500 })
  }
}
