"use client";
import { useState } from "react";
import { TopBar } from "@/components/TopBar";

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string>("");

  function onSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setStatus(f ? `Selected ${f.name} (${(f.size / 1024).toFixed(1)} KB)` : "");
  }

  function upload() {
    if (!file) { setStatus("Pick a CSV first"); return; }
    setStatus("CSV parsing lands in v1.1 — file accepted, queued for processing.");
  }

  return (
    <div>
      <TopBar title="Import Data" />
      <div className="p-6 max-w-2xl">
        <h1 className="text-lg font-semibold mb-2">Import Data</h1>
        <p className="text-sm text-muted-foreground mb-4">Upload a CSV export from SmartMoving, ServiceMonster, or any CRM. Mapping happens server-side.</p>
        <div className="border border-dashed border-border rounded-md p-6 text-center">
          <input type="file" accept=".csv" onChange={onSelect} className="text-sm" />
          {status && <div className="text-xs text-muted-foreground mt-3">{status}</div>}
          <button onClick={upload} disabled={!file} className="mt-4 px-3 py-1.5 text-sm rounded-md bg-accent text-white disabled:opacity-50">Upload</button>
        </div>
      </div>
    </div>
  );
}
