/** @type {import('next').NextConfig} */
export default {
  transpilePackages: [
    "@callscrapercrm/core",
    "@callscrapercrm/plugin-sdk",
    "@callscrapercrm/ai",
    "@callscrapercrm/sdk",
  ],
  async headers() {
    // The customer-facing estimate page embeds an HMAC token in the URL
    // (`/estimate/[id]?t=...`). Without a Referrer-Policy, the browser would
    // leak the full URL (including the token) to any third-party site the
    // customer clicks through to (the company phone link, an email link, etc.)
    // via the Referer header.
    //
    // The layout sets a `<meta name="referrer">` tag too, but that is only
    // honored after the parser reaches it. The HTTP header is enforced from
    // the very first byte and covers embedded contexts the meta tag misses.
    //
    // X-Robots-Tag belt-and-suspenders the `noindex` metadata so even crawlers
    // that ignore meta tags (some proxies, image bots) won't index estimate
    // URLs.
    return [
      {
        source: "/estimate/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};
