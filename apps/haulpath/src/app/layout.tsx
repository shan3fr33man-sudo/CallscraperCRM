import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'HaulPath - Smart Route Planning for Truck Drivers',
  description: 'Plan your route with optimized truck stops and hotels. One tap opens in Google Maps.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-cream text-navy">{children}</body>
    </html>
  )
}
