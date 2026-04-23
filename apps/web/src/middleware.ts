import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Prefix-matched paths that bypass the Supabase session check in middleware.
// API routes enforce their own auth. Public customer-facing pages
// (/estimate/[id]) use HMAC tokens as their auth. The /launch handoff
// validates a bridge JWT itself; if invalid, it renders an inline error
// rather than redirecting to the internal login.
const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/auth",
  "/api/",
  "/_next/",
  "/favicon.ico",
  "/estimate/", // public customer-facing estimate pages, HMAC-token gated
  "/embed/", // iframe-mountable routes (auth delegated to parent via postMessage)
];

// Exact-match public paths (no prefix match) so e.g. /launch doesn't also
// open /launchpad if someone adds that route later. `/demo` performs its own
// client-side Supabase sign-in with pre-filled demo credentials.
const PUBLIC_PATHS_EXACT = new Set<string>(["/launch", "/demo"]);

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  if (PUBLIC_PATHS_EXACT.has(pathname) || PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const res = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cs: { name: string; value: string; options?: Record<string, unknown> }[]) =>
          cs.forEach(({ name, value, options }) => res.cookies.set(name, value, options as never)),
      },
    },
  );

  const { data: userRes } = await supabase.auth.getUser();

  if (!userRes?.user) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
