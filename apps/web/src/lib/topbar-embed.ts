// Helper for postMessage bridge between callscraper.com parent window
// and the CRM TopBar iframe. Scope: narrow — just announce action
// intents up, and accept session-ping messages down.

// Allowlist of parent origins that are trusted to host the CRM embed.
// Extend via NEXT_PUBLIC_EMBED_PARENT_ORIGINS = "https://callscraper.com,https://www.callscraper.com"
const DEFAULT_ALLOWED = [
  "https://callscraper.com",
  "https://www.callscraper.com",
  "http://localhost:3000",
  "http://localhost:3010",
];
function allowedOrigins(): string[] {
  const extra = process.env.NEXT_PUBLIC_EMBED_PARENT_ORIGINS?.split(",").map(s => s.trim()).filter(Boolean) ?? [];
  return [...new Set([...DEFAULT_ALLOWED, ...extra])];
}

export type EmbedMessage =
  | { type: "crm.new-menu-open" }
  | { type: "crm.new-menu-select"; kind: string }
  | { type: "crm.search-submit"; query: string }
  | { type: "crm.bell-click" }
  | { type: "crm.user-menu-click" }
  | { type: "parent.session-ping"; user_id: string };

/** Post a message up to the parent. REQUIRES explicit targetOrigin — no "*" default. */
export function postToParent(msg: EmbedMessage, targetOrigin: string) {
  if (typeof window === "undefined") return;
  if (window.parent === window) return;
  if (!allowedOrigins().includes(targetOrigin)) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[topbar-embed] refusing to postMessage to non-allowlisted origin:", targetOrigin);
    }
    return;
  }
  window.parent.postMessage({ source: "callscrapercrm-topbar", ...msg }, targetOrigin);
}

/** Listen for messages from the parent. Validates event.origin. */
export function listenFromParent(cb: (msg: EmbedMessage) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: MessageEvent) => {
    if (!allowedOrigins().includes(e.origin)) return;
    const d = e.data;
    if (d && typeof d === "object" && d.source === "callscraper-parent") cb(d as EmbedMessage);
  };
  window.addEventListener("message", handler);
  return () => window.removeEventListener("message", handler);
}

export function __allowedOrigins() { return allowedOrigins(); } // exposed for tests
