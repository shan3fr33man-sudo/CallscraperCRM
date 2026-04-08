import "server-only";
import { crmClient, DEFAULT_ORG_ID } from "./crmdb";

const PROVIDER = "callscraper";
const EPOCH = "2020-01-01T00:00:00Z";

export type SyncStateRow = {
  id: string;
  org_id: string;
  provider_key: string;
  table_name: string;
  cursor: string | null;
  rows_synced: number | null;
  last_run_at: string | null;
  status: string | null;
  error: string | null;
};

export async function getCursor(entity: string): Promise<string> {
  const sb = crmClient();
  const { data } = await sb
    .from("sync_state")
    .select("cursor")
    .eq("org_id", DEFAULT_ORG_ID)
    .eq("provider_key", PROVIDER)
    .eq("table_name", entity)
    .maybeSingle();
  return (data?.cursor as string | undefined) ?? EPOCH;
}

export async function advanceCursor(entity: string, newCursor: string, rowsSynced: number): Promise<void> {
  const sb = crmClient();
  await sb.from("sync_state").upsert(
    {
      org_id: DEFAULT_ORG_ID,
      provider_key: PROVIDER,
      table_name: entity,
      cursor: newCursor,
      rows_synced: rowsSynced,
      last_run_at: new Date().toISOString(),
      status: "ok",
      error: null,
    },
    { onConflict: "org_id,provider_key,table_name" }
  );
}

export async function markError(entity: string, error: string): Promise<void> {
  const sb = crmClient();
  await sb.from("sync_state").upsert(
    {
      org_id: DEFAULT_ORG_ID,
      provider_key: PROVIDER,
      table_name: entity,
      last_run_at: new Date().toISOString(),
      status: "error",
      error,
    },
    { onConflict: "org_id,provider_key,table_name" }
  );
}

export async function getStatus(): Promise<SyncStateRow[]> {
  const sb = crmClient();
  const { data } = await sb
    .from("sync_state")
    .select("*")
    .eq("org_id", DEFAULT_ORG_ID)
    .eq("provider_key", PROVIDER);
  return (data ?? []) as SyncStateRow[];
}
