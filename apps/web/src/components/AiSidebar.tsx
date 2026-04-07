"use client";
import { useState } from "react";
import { X, Send } from "lucide-react";

interface Msg { role: "user" | "assistant"; content: string }

export function AiSidebar({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function send() {
    if (!input.trim() || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: input }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const r = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const j = (await r.json()) as { reply?: string; error?: string };
      setMessages([...next, { role: "assistant", content: j.reply ?? j.error ?? "(no reply)" }]);
    } catch (e) {
      setMessages([...next, { role: "assistant", content: `Error: ${(e as Error).message}` }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-[420px] h-full bg-panel border-l border-border flex flex-col"
      >
        <div className="h-12 border-b border-border px-4 flex items-center justify-between">
          <div className="text-sm font-medium">Claude</div>
          <button onClick={onClose} className="text-muted hover:text-text">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3 text-sm">
          {messages.length === 0 && (
            <div className="text-muted text-xs">
              Ask anything about your calls, leads, or pipeline. I have access to the CRM via tools.
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "text-text" : "text-text/90"}>
              <div className="text-[10px] uppercase text-muted mb-1">{m.role}</div>
              <div className="whitespace-pre-wrap">{m.content}</div>
            </div>
          ))}
          {loading && <div className="text-muted text-xs">thinking…</div>}
        </div>
        <div className="border-t border-border p-3 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Message Claude…"
            className="flex-1 bg-bg border border-border rounded px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <button
            onClick={send}
            disabled={loading}
            className="px-3 rounded bg-accent text-white text-sm disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
