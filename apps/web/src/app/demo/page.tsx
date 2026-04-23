"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/client";

const DEMO_EMAIL = "info@aperfectmover.com";
const DEMO_PASSWORD = "Sayon143$";

export default function DemoPage() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/";
  const [status, setStatus] = useState<"signing-in" | "error">("signing-in");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    (async () => {
      const sb = createBrowserSupabase();
      const { error: err } = await sb.auth.signInWithPassword({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
      });
      if (err) {
        setError(err.message);
        setStatus("error");
        return;
      }
      router.replace(next);
      router.refresh();
    })();
  }, [router, next]);

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4 text-white">
      {status === "signing-in" ? (
        <div className="text-gray-300">Signing you in as the demo operator…</div>
      ) : (
        <div className="max-w-md text-center">
          <p className="text-red-400 mb-4">Demo sign-in failed: {error}</p>
          <a className="text-blue-400 hover:underline" href="/login">
            Go to the login page
          </a>
        </div>
      )}
    </div>
  );
}
