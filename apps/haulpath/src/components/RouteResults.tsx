'use client'

import { useState } from 'react'
import { buildGoogleMapsPlaceUrl } from '@/lib/googleMapsUrl'

type Stop = {
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
}

type Hotel = {
  id: string
  name: string
  city: string
  state: string
  lat: number
  lng: number
  nightly_rate_low?: number
}

type RouteResultsProps = {
  data: {
    origin: { lat: number; lng: number }
    destination: { lat: number; lng: number }
    stops: Stop[]
    hotels: Hotel[]
    googleMapsUrl: string
    routeSummary: {
      distance: string
      duration: string
    }
  }
  onNew: () => void
}

export default function RouteResults({ data, onNew }: RouteResultsProps) {
  const [activeTab, setActiveTab] = useState<'stops' | 'hotels'>('stops')

  const PriceColor = ({ price }: { price?: number }) => {
    if (!price) return null
    if (price < 3.0) return 'bg-green-100 text-green-900'
    if (price < 3.5) return 'bg-yellow-100 text-yellow-900'
    return 'bg-red-100 text-red-900'
  }

  return (
    <div className="min-h-screen bg-cream text-navy">
      {/* Sticky Top Banner */}
      <div className="sticky top-0 z-50 bg-orange-500 p-4 shadow-lg">
        <button
          onClick={() => window.open(data.googleMapsUrl, '_blank')}
          className="w-full py-4 px-6 text-2xl font-bold bg-white hover:bg-gray-100 text-orange-500 rounded-lg transition-colors"
        >
          Open Route in Google Maps
        </button>
      </div>

      <div className="p-4 max-w-2xl mx-auto pb-12">
        {/* Trip Summary */}
        <div className="mt-6 mb-8 p-6 bg-white rounded-lg border-2 border-navy shadow-md">
          <h2 className="text-2xl font-bold text-navy mb-4">Trip Summary</h2>
          <p className="text-xl text-gray-700">
            <span className="font-semibold">{data.routeSummary.distance}</span> ·
            <span className="font-semibold ml-2">{data.routeSummary.duration}</span>
          </p>
        </div>

        {/* Tab Strip */}
        <div className="flex gap-2 mb-6 border-b-2 border-navy">
          <button
            onClick={() => setActiveTab('stops')}
            className={`px-6 py-3 text-lg font-semibold border-b-4 ${
              activeTab === 'stops'
                ? 'border-orange-500 text-navy'
                : 'border-transparent text-gray-500'
            }`}
          >
            Truck Stops ({data.stops.length})
          </button>
          {data.hotels.length > 0 && (
            <button
              onClick={() => setActiveTab('hotels')}
              className={`px-6 py-3 text-lg font-semibold border-b-4 ${
                activeTab === 'hotels'
                  ? 'border-orange-500 text-navy'
                  : 'border-transparent text-gray-500'
              }`}
            >
              Hotels ({data.hotels.length})
            </button>
          )}
        </div>

        {/* Stops Tab */}
        {activeTab === 'stops' && (
          <div className="space-y-4">
            {data.stops.length === 0 ? (
              <p className="text-lg text-gray-600 text-center py-8">
                No truck stops found on this route.
              </p>
            ) : (
              data.stops.map((stop, idx) => (
                <StopCard key={stop.id} stop={stop} index={idx + 1} />
              ))
            )}
          </div>
        )}

        {/* Hotels Tab */}
        {activeTab === 'hotels' && data.hotels.length > 0 && (
          <div className="space-y-4">
            {data.hotels.map((hotel, idx) => (
              <HotelCard key={hotel.id} hotel={hotel} index={idx + 1} />
            ))}
          </div>
        )}

        {/* New Route Button */}
        <div className="mt-8 pt-6 border-t-2 border-navy">
          <button
            onClick={onNew}
            className="w-full py-3 px-6 text-lg font-semibold text-navy border-2 border-navy hover:bg-navy hover:text-cream rounded-lg transition-colors"
          >
            Plan Another Route
          </button>
        </div>
      </div>
    </div>
  )
}

function StopCard({ stop, index }: { stop: Stop; index: number }) {
  return (
    <div className="p-6 bg-white rounded-lg border-2 border-navy shadow-md hover:shadow-lg transition-shadow">
      <div className="flex items-start gap-4">
        {/* Badge */}
        <div className="flex-shrink-0 w-16 h-16 bg-navy text-cream rounded-full flex items-center justify-center text-3xl font-bold">
          {index}
        </div>

        {/* Content */}
        <div className="flex-grow">
          <h3 className="text-2xl font-bold text-navy mb-2">
            {stop.name}
          </h3>
          <p className="text-lg text-gray-700 mb-3">
            {stop.city}, {stop.state}
          </p>

          {/* Highway/Exit */}
          <div className="flex items-center gap-2 mb-3">
            <div className="inline-block bg-yellow-400 px-3 py-1 rounded font-bold text-navy">
              {stop.highway}
            </div>
            {stop.exit_number && (
              <span className="text-gray-600">Exit {stop.exit_number}</span>
            )}
          </div>

          {/* Price */}
          {stop.price && (
            <div className={`inline-block px-4 py-2 rounded-lg font-semibold text-lg mb-3 ${
              stop.price < 3.0 ? 'bg-green-100 text-green-900' :
              stop.price < 3.5 ? 'bg-yellow-100 text-yellow-900' :
              'bg-red-100 text-red-900'
            }`}>
              ${stop.price.toFixed(2)}/gal
            </div>
          )}

          {/* Maps Button */}
          <button
            onClick={() => {
              const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                stop.name
              )}`
              window.open(url, '_blank')
            }}
            className="block mt-4 text-lg font-semibold text-orange-500 hover:text-orange-700 underline"
          >
            Open in Maps →
          </button>
        </div>
      </div>
    </div>
  )
}

function HotelCard({ hotel, index }: { hotel: Hotel; index: number }) {
  return (
    <div className="p-6 bg-white rounded-lg border-2 border-navy shadow-md hover:shadow-lg transition-shadow">
      <div className="flex items-start gap-4">
        {/* Badge */}
        <div className="flex-shrink-0 w-16 h-16 bg-navy text-cream rounded-full flex items-center justify-center text-3xl font-bold">
          {index}
        </div>

        {/* Content */}
        <div className="flex-grow">
          <h3 className="text-2xl font-bold text-navy mb-2">
            {hotel.name}
          </h3>
          <p className="text-lg text-gray-700 mb-3">
            {hotel.city}, {hotel.state}
          </p>

          {/* Price */}
          {hotel.nightly_rate_low && (
            <div className="bg-blue-100 text-blue-900 inline-block px-4 py-2 rounded-lg font-semibold text-lg mb-3">
              From ${hotel.nightly_rate_low.toFixed(2)}/night
            </div>
          )}

          {/* Maps Button */}
          <button
            onClick={() => {
              const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                hotel.name
              )}`
              window.open(url, '_blank')
            }}
            className="block mt-4 text-lg font-semibold text-orange-500 hover:text-orange-700 underline"
          >
            Open in Maps →
          </button>
        </div>
      </div>
    </div>
  )
}
