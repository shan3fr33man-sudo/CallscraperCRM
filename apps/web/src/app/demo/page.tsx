"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/client";

const DEMO_EMAIL = "info@aperfectmover.com";
const DEMO_PASSWORD = "Sayon143$";

function DemoSignIn() {
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

  if (status === "signing-in") {
    return <div className="text-gray-300">Signing you in as the demo operator…</div>;
  }
  return (
    <div className="max-w-md text-center">
      <p className="text-red-400 mb-4">Demo sign-in failed: {error}</p>
      <a className="text-blue-400 hover:underline" href="/login">
        Go to the login page
      </a>
    </div>
  );
}

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4 text-white">
      <Suspense fallback={<div className="text-gray-300">Loading…</div>}>
        <DemoSignIn />
      </Suspense>
    </div>
  );
}
