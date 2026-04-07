"use client";
import { useEffect, useState } from "react";
import { TopBar } from "@/components/TopBar";
import { Plus, Trash2 } from "lucide-react";

interface FieldRow {
  id: string;
  key: string;
  label: string;
  type: string;
}
interface ObjectRow {
  id: string;
  key: string;
  label: string;
  is_system: boolean;
  fields: FieldRow[];
}

const TYPES = ["text", "number", "bool", "date", "json", "ref", "vector"];

export default function ObjectsBuilder() {
  const [objects, setObjects] = useState<ObjectRow[]>([]);
  const [newObj, setNewObj] = useState({ key: "", label: "" });
  const [newField, setNewField] = useState<Record<string, { key: string; label: string; type: string }>>({});

  async function load() {
    const r = await fetch("/api/objects");
    const j = (await r.json()) as { objects: ObjectRow[] };
    setObjects(j.objects ?? []);
  }
  useEffect(() => {
    load();
  }, []);

  async function createObject() {
    if (!newObj.key || !newObj.label) return;
    await fetch("/api/objects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(newObj),
    });
    setNewObj({ key: "", label: "" });
    await load();
  }

  async function addField(objectId: string) {
    const f = newField[objectId];
    if (!f?.key || !f?.label || !f?.type) return;
    await fetch("/api/fields", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ object_id: objectId, ...f }),
    });
    setNewField({ ...newField, [objectId]: { key: "", label: "", type: "text" } });
    await load();
  }

  async function deleteField(id: string) {
    await fetch(`/api/fields?id=${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <>
      <TopBar title="Custom Objects" />
      <div className="p-6 max-w-4xl space-y-6">
        <div className="rounded-lg border border-border bg-panel p-4">
          <div className="text-xs uppercase text-muted mb-2">New object</div>
          <div className="flex gap-2">
            <input
              placeholder="key (e.g. property)"
              value={newObj.key}
              onChange={(e) => setNewObj({ ...newObj, key: e.target.value })}
              className="flex-1 bg-bg border border-border rounded px-2 py-1.5 text-sm outline-none focus:border-accent"
            />
            <input
              placeholder="Label (e.g. Property)"
              value={newObj.label}
              onChange={(e) => setNewObj({ ...newObj, label: e.target.value })}
              className="flex-1 bg-bg border border-border rounded px-2 py-1.5 text-sm outline-none focus:border-accent"
            />
            <button onClick={createObject} className="px-3 rounded bg-accent text-white text-sm">
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {objects.map((o) => {
          const draft = newField[o.id] ?? { key: "", label: "", type: "text" };
          return (
            <div key={o.id} className="rounded-lg border border-border bg-panel">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{o.label}</div>
                  <div className="text-[11px] text-muted">{o.key}{o.is_system && " · system"}</div>
                </div>
              </div>
              <div className="p-4 space-y-2">
                {(o.fields ?? []).map((f) => (
                  <div key={f.id} className="flex items-center gap-2 text-sm">
                    <div className="flex-1">
                      <div>{f.label}</div>
                      <div className="text-[11px] text-muted">
                        {f.key} · {f.type}
                      </div>
                    </div>
                    <button onClick={() => deleteField(f.id)} className="text-muted hover:text-red-400">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <div className="flex gap-2 pt-2 border-t border-border">
                  <input
                    placeholder="key"
                    value={draft.key}
                    onChange={(e) => setNewField({ ...newField, [o.id]: { ...draft, key: e.target.value } })}
                    className="flex-1 bg-bg border border-border rounded px-2 py-1 text-xs outline-none focus:border-accent"
                  />
                  <input
                    placeholder="Label"
                    value={draft.label}
                    onChange={(e) => setNewField({ ...newField, [o.id]: { ...draft, label: e.target.value } })}
                    className="flex-1 bg-bg border border-border rounded px-2 py-1 text-xs outline-none focus:border-accent"
                  />
                  <select
                    value={draft.type}
                    onChange={(e) => setNewField({ ...newField, [o.id]: { ...draft, type: e.target.value } })}
                    className="bg-bg border border-border rounded px-2 py-1 text-xs"
                  >
                    {TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <button onClick={() => addField(o.id)} className="px-2 rounded bg-accent text-white text-xs">
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
