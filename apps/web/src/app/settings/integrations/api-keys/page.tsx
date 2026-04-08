"use client";
import { useEffect, useState } from "react";

type KeyRow = { provider: string; masked: string; created_at: string };
const PROVIDERS = [
  { key: "anthropic", label: "Anthropic", hint: "sk-ant-..." },
  { key: "twilio", label: "Twilio API Key SID", hint: "SK..." },
  { key: "resend", label: "Resend", hint: "re_..." },
];

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [provider, setProvider] = useState("anthropic");
  const [key, setKey] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    const r = await fetch("/api/settings/api-keys");
    const j = await r.json();
    setKeys(j.keys ?? []);
  }
  useEffect(() => {
    load();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    const r = await fetch("/api/settings/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, key }),
    });
    const j = await r.json();
    setLoading(false);
    if (!r.ok) {
      setMsg(j.error ?? "Save failed");
      return;
    }
    setKey("");
    setMsg("Saved");
    load();
  }

  async function remove(p: string) {
    if (!confirm(`Remove ${p} key?`)) return;
    await fetch(`/api/settings/api-keys?provider=${p}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-semibold mb-2">API Keys</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Connect third-party providers. Keys are stored encrypted per workspace and never leave your Supabase project.
      </p>

      <div className="bg-background border border-border rounded-lg p-5 mb-6">
        <h2 className="text-lg font-medium mb-4">Add / replace a key</h2>
        <form onSubmit={save} className="space-y-3">
          <div>
            <label className="block text-sm mb-1">Provider</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded"
            >
              {PROVIDERS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">Key</label>
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder={PROVIDERS.find((p) => p.key === provider)?.hint}
              className="w-full px-3 py-2 bg-background border border-border rounded font-mono text-sm"
              required
            />
          </div>
          {msg && <div className="text-sm text-muted-foreground">{msg}</div>}
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-accent text-white rounded hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save key"}
          </button>
        </form>
      </div>

      <div className="bg-background border border-border rounded-lg p-5">
        <h2 className="text-lg font-medium mb-4">Connected keys</h2>
        {keys.length === 0 ? (
          <p className="text-sm text-muted-foreground">No keys yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {keys.map((k) => (
              <li key={k.provider} className="py-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium capitalize">{k.provider}</div>
                  <div className="text-xs font-mono text-muted-foreground">{k.masked}</div>
                </div>
                <button
                  onClick={() => remove(k.provider)}
                  className="text-sm text-red-500 hover:underline"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
