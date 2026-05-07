'use client'

import { useState } from 'react'
import RouteForm from '@/components/RouteForm'
import RouteResults from '@/components/RouteResults'

type RouteData = {
  origin: { lat: number; lng: number }
  destination: { lat: number; lng: number }
  stops: Array<{
    id: string
    name: string
    city: string
    state: string
    highway: string
    exit_number?: string
    lat: number
    lng: number
    price?: number
    brand?: string
  }>
  hotels: Array<{
    id: string
    name: string
    city: string
    state: string
    lat: number
    lng: number
    nightly_rate_low?: number
  }>
  googleMapsUrl: string
  routeSummary: {
    distance: string
    duration: string
  }
}

export default function Home() {
  const [routeData, setRouteData] = useState<RouteData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handlePlanRoute = async (from: string, to: string, includeHotels: boolean) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/plan-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to, includeHotels }),
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to plan route')
      }
      const data: RouteData = await response.json()
      setRouteData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-cream text-navy">
      {!routeData ? (
        <RouteForm onSubmit={handlePlanRoute} loading={loading} error={error} />
      ) : (
        <RouteResults
          data={routeData}
          onNew={() => {
            setRouteData(null)
            setError(null)
          }}
        />
      )}
    </main>
  )
}
