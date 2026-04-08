"use client";
import { useState } from "react";
import Link from "next/link";
import { createBrowserSupabase } from "@/lib/supabase/client";

const ITEMS = [
  { label: "My Account", href: "/settings/company/details" },
  { label: "Billing", href: "/settings/company/billing" },
  { label: "API Keys", href: "/settings/integrations/api-keys" },
  { label: "Notifications", href: "/settings/company/notifications" },
  { label: "Help & Support", href: "/help" },
];

export function UserMenu({ displayName = "Shane", email = "shane@callscraper.com" }: { displayName?: string; email?: string }) {
  const [open, setOpen] = useState(false);
  const initials = displayName.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  async function signOut() {
    try {
      await createBrowserSupabase().auth.signOut();
    } catch (e) {
      console.error("signOut failed", e);
    }
    window.location.href = "/login";
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="w-8 h-8 rounded-full bg-accent text-white text-xs font-medium flex items-center justify-center hover:opacity-90" aria-label="User menu">
        {initials}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 z-50 w-64 bg-background border border-border rounded-md shadow-lg">
            <div className="px-3 py-2 border-b border-border">
              <div className="text-sm font-medium">{displayName}</div>
              <div className="text-xs text-muted-foreground">{email}</div>
            </div>
            <div className="py-1">
              {ITEMS.map((it) => (
                <Link key={it.href} href={it.href} onClick={() => setOpen(false)} className="block px-3 py-1.5 text-sm hover:bg-accent/10">{it.label}</Link>
              ))}
              <button onClick={signOut} className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent/10 border-t border-border mt-1">Sign Out</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
