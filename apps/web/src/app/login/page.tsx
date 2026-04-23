"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/client";

// Demo credentials surfaced in the UI so operators (and any visitor) can
// jump straight in without credential management. Safe for the current demo
// stage; remove the button once real tenants onboard.
const DEMO_EMAIL = "info@aperfectmover.com";
const DEMO_PASSWORD = "Sayon143$";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/";

  async function signInWith(creds: { email: string; password: string }) {
    setLoading(true);
    setError("");
    const sb = createBrowserSupabase();
    const { error: err } = await sb.auth.signInWithPassword(creds);
    if (err) {
      setError(err.message);
      setLoading(false);
      return false;
    }
    router.push(next);
    router.refresh();
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await signInWith({ email, password });
  }

  async function handleDemo() {
    await signInWith({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">CallscraperCRM</h1>
          <p className="text-gray-400 mt-2">Moving company intelligence platform</p>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-8">
          <h2 className="text-xl font-semibold text-white mb-6">Sign in</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@company.com"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            {error && (
              <div className="p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-400 text-sm">{error}</div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-800">
            <button
              type="button"
              onClick={handleDemo}
              disabled={loading}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              {loading ? "Signing in…" : "Try the demo (one click)"}
            </button>
            <p className="text-gray-500 text-xs mt-2 text-center">
              Signs you in as <span className="text-gray-400">{DEMO_EMAIL}</span>
            </p>
          </div>

          <p className="text-gray-400 text-sm mt-6 text-center">
            No workspace?{" "}
            <a href="/signup" className="text-blue-400 hover:underline">
              Create one
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-950" />}>
      <LoginForm />
    </Suspense>
  );
}
