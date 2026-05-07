'use client'

import { useState } from 'react'

type RouteFormProps = {
  onSubmit: (from: string, to: string, includeHotels: boolean) => void
  loading: boolean
  error?: string | null
}

export default function RouteForm({ onSubmit, loading, error }: RouteFormProps) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [includeHotels, setIncludeHotels] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!from.trim() || !to.trim()) {
      alert('Please enter both origin and destination')
      return
    }
    onSubmit(from, to, includeHotels)
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo/Title */}
        <div className="mb-12 text-center">
          <h1 className="text-5xl font-bold text-navy mb-2">HaulPath</h1>
          <p className="text-xl text-gray-600">Smart route planning for truck drivers</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* From Input */}
          <div>
            <label htmlFor="from" className="block text-xl font-semibold mb-2 text-navy">
              From
            </label>
            <input
              id="from"
              type="text"
              placeholder="e.g., Denver, CO or 1234 Main St, Denver, CO"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full px-6 py-4 text-xl border-2 border-navy rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              disabled={loading}
            />
          </div>

          {/* To Input */}
          <div>
            <label htmlFor="to" className="block text-xl font-semibold mb-2 text-navy">
              To
            </label>
            <input
              id="to"
              type="text"
              placeholder="e.g., Wichita, KS or 5678 Main St, Wichita, KS"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full px-6 py-4 text-xl border-2 border-navy rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              disabled={loading}
            />
          </div>

          {/* Hotels Toggle */}
          <div className="flex items-center gap-4 py-2">
            <input
              id="hotels"
              type="checkbox"
              checked={includeHotels}
              onChange={(e) => setIncludeHotels(e.target.checked)}
              className="w-6 h-6 cursor-pointer"
              disabled={loading}
            />
            <label htmlFor="hotels" className="text-lg font-medium cursor-pointer text-navy">
              Include truck-friendly hotels
            </label>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-100 border-2 border-red-500 rounded-lg text-red-700 text-lg">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 px-6 text-2xl font-bold bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white rounded-lg transition-colors"
          >
            {loading ? 'Planning...' : 'Plan My Route'}
          </button>
        </form>
      </div>
    </div>
  )
}
