"use client";

import { TopBar } from "@/components/TopBar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function EmbedTopBarPage() {
  return (
    <div className="bg-bg text-text">
      <TopBar title="" />
    </div>
  );
}
