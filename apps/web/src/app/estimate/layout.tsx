import type { ReactNode } from "react";
import type { Metadata } from "next";

/**
 * Layout for public /estimate/[id] customer-facing pages.
 *
 * The hard enforcement for referrer leaks is in `next.config.mjs`, which
 * emits a real `Referrer-Policy: no-referrer` HTTP response header on every
 * `/estimate/:path*` request. That header is authoritative from byte one
 * and covers embedded contexts and pre-parser resources.
 *
 * This layout adds the matching `<meta name="referrer">` tag as a
 * belt-and-suspenders fallback for clients that prefer meta over headers
 * (uncommon but cheap to ship), and declares noindex so search engines
 * don't cache per-customer estimate URLs.
 *
 * Without any of this, the HMAC token in `?t=...` would leak to the
 * destination via the Referer header when a customer clicks an external
 * link from the estimate (phone/email/address). The fully-paranoid fix
 * swaps the token into a cookie via history.replaceState on mount; the
 * header+meta approach is the lighter fix that ships with this module.
 */
export const metadata: Metadata = {
  title: "Your estimate",
  referrer: "no-referrer",
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

export default function EstimateLayout({ children }: { children: ReactNode }) {
  return children;
}
