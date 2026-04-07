import { createBrowserClient, createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export function browserSupabase() {
  return createBrowserClient(url, anon);
}

export async function serverSupabase() {
  const store = await cookies();
  return createServerClient(url, anon, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (toSet) => toSet.forEach(({ name, value, options }) => store.set(name, value, options)),
    },
  });
}
