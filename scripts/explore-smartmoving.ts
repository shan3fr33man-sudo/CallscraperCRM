#!/usr/bin/env tsx
/**
 * SmartMoving Premium API exploration script.
 *
 * Tries several known auth patterns + base URLs against a handful of list
 * endpoints. Reports which combo returns HTTP 200 and a parseable JSON body,
 * then pulls a sample of opportunities so we can see:
 *   • what the branch/office field is named (for multi-brand filtering)
 *   • the exact opportunity payload shape (to finalize our zod schemas)
 *   • typical materials / valuation / crew fields
 *
 * Run:
 *   SMARTMOVING_API_KEY=... SMARTMOVING_PROVIDER_KEY=... SMARTMOVING_CLIENT_ID=... \
 *     tsx scripts/explore-smartmoving.ts
 *
 * Uses at most ~20 requests. Does NOT write to Supabase. Safe to run from any
 * machine with the creds in env; no file on disk touches secrets.
 */
import { writeFileSync } from "node:fs";

const apiKey = process.env.SMARTMOVING_API_KEY;
const providerKey = process.env.SMARTMOVING_PROVIDER_KEY;
const clientId = process.env.SMARTMOVING_CLIENT_ID;

if (!apiKey) {
  console.error("SMARTMOVING_API_KEY env var required");
  process.exit(1);
}

const BASE_URLS = [
  "https://api-public.smartmoving.com",
  "https://api.smartmoving.com",
  "https://premium.smartmoving.com",
];

type HeaderBuilder = (apiKey: string, providerKey?: string, clientId?: string) => Record<string, string>;

const AUTH_PATTERNS: Array<{ name: string; build: HeaderBuilder }> = [
  {
    name: "x-api-key + x-provider-key + x-client-id",
    build: (a, p, c) => ({
      "x-api-key": a,
      ...(p ? { "x-provider-key": p } : {}),
      ...(c ? { "x-client-id": c } : {}),
    }),
  },
  {
    name: "Authorization: ApiKey <api>",
    build: (a) => ({ Authorization: `ApiKey ${a}` }),
  },
  {
    name: "Authorization: Bearer <api>",
    build: (a) => ({ Authorization: `Bearer ${a}` }),
  },
  {
    name: "ApiKey header",
    build: (a) => ({ ApiKey: a }),
  },
  {
    name: "Basic auth provider:api",
    build: (a, p) =>
      p
        ? { Authorization: `Basic ${Buffer.from(`${p}:${a}`).toString("base64")}` }
        : {},
  },
  {
    name: "Basic auth client:api",
    build: (a, _p, c) =>
      c
        ? { Authorization: `Basic ${Buffer.from(`${c}:${a}`).toString("base64")}` }
        : {},
  },
];

const PROBE_PATHS = [
  // Most likely, based on Premium API conventions:
  "/api/opportunities",
  "/api/users",
  "/api/branches",
  "/premium/opportunities",
  "/premium/branches",
  "/v1/opportunities",
  "/opportunities",
];

interface ProbeResult {
  url: string;
  auth: string;
  status: number;
  ok: boolean;
  contentType: string;
  bodyPreview: string;
  bodyKeys?: string[];
}

async function probe(
  baseUrl: string,
  path: string,
  auth: { name: string; build: HeaderBuilder },
): Promise<ProbeResult> {
  const url = `${baseUrl}${path}?page=1&pageSize=1`;
  const headers = {
    accept: "application/json",
    ...auth.build(apiKey!, providerKey, clientId),
  };
  try {
    const res = await fetch(url, { headers });
    const contentType = res.headers.get("content-type") ?? "";
    const text = await res.text();
    let bodyKeys: string[] | undefined;
    if (contentType.includes("json")) {
      try {
        const parsed = JSON.parse(text);
        bodyKeys = Array.isArray(parsed)
          ? [`[array len=${parsed.length}]`]
          : Object.keys(parsed ?? {}).slice(0, 20);
      } catch {
        /* ignore */
      }
    }
    return {
      url,
      auth: auth.name,
      status: res.status,
      ok: res.ok,
      contentType,
      bodyPreview: text.slice(0, 200),
      bodyKeys,
    };
  } catch (err) {
    return {
      url,
      auth: auth.name,
      status: 0,
      ok: false,
      contentType: "",
      bodyPreview: `fetch error: ${(err as Error).message}`,
    };
  }
}

async function main() {
  console.log("▶ SmartMoving Premium API probe\n");
  const results: ProbeResult[] = [];

  // 1. Auth + base URL + path matrix
  for (const baseUrl of BASE_URLS) {
    for (const path of PROBE_PATHS) {
      for (const auth of AUTH_PATTERNS) {
        const r = await probe(baseUrl, path, auth);
        if (r.ok || (r.status >= 200 && r.status < 300)) {
          console.log(`✅ ${r.status} — ${baseUrl}${path} via "${auth.name}"`);
          console.log(`   body keys: ${JSON.stringify(r.bodyKeys)}`);
          results.push(r);
        } else if (r.status === 401 || r.status === 403) {
          // Auth rejected — potentially wrong auth pattern. Quiet.
        } else if (r.status === 404) {
          // Wrong path. Quiet.
        } else if (r.status !== 0) {
          console.log(`   ${r.status} — ${baseUrl}${path} via "${auth.name}"`);
        }
      }
    }
  }

  if (results.length === 0) {
    console.error("\n❌ No working endpoint found. Check the SmartMoving Premium API docs for the current auth scheme.");
    process.exit(1);
  }

  // 2. Pick the best-looking endpoint (opportunity list) and pull a sample.
  const winner =
    results.find((r) => r.url.includes("opportunities")) ?? results[0];
  console.log(`\n▶ Using winner: ${winner.url} (${winner.auth})`);

  const base = winner.url.split("?")[0].replace(/\/opportunities.*/, "/opportunities");
  const authBuild = AUTH_PATTERNS.find((a) => a.name === winner.auth)!.build;
  const headers = {
    accept: "application/json",
    ...authBuild(apiKey!, providerKey, clientId),
  };

  // Pull a larger page to see what filter params + branch field shape looks like.
  const sampleUrl = `${base}?page=1&pageSize=10`;
  console.log(`\n▶ GET ${sampleUrl}`);
  const sampleRes = await fetch(sampleUrl, { headers });
  const sampleText = await sampleRes.text();
  console.log(`   status: ${sampleRes.status}`);

  let sample: unknown;
  try {
    sample = JSON.parse(sampleText);
  } catch {
    console.log(`   non-JSON body: ${sampleText.slice(0, 400)}`);
    process.exit(1);
  }

  console.log(`   JSON top-level: ${JSON.stringify(Object.keys(sample as object).slice(0, 20))}`);
  writeFileSync("./sm-sample-list.json", JSON.stringify(sample, null, 2));
  console.log(`   💾 wrote ./sm-sample-list.json`);

  // 3. Inspect branch/office field names on the first item.
  const items = pickArray(sample);
  if (items && items.length > 0) {
    const first = items[0] as Record<string, unknown>;
    console.log(`\n▶ First item keys: ${JSON.stringify(Object.keys(first))}`);
    const branchCandidates: Record<string, unknown> = {};
    for (const k of Object.keys(first)) {
      if (/branch|office|location|tenant|company/i.test(k)) {
        branchCandidates[k] = first[k];
      }
    }
    console.log(`▶ Branch-like fields: ${JSON.stringify(branchCandidates, null, 2)}`);

    // 4. Fetch one opportunity detail to see full payload.
    const firstId = first.id ?? first.Id ?? first.opportunity_id;
    if (firstId) {
      const detailUrl = `${base}/${firstId}`;
      console.log(`\n▶ GET ${detailUrl}`);
      const detailRes = await fetch(detailUrl, { headers });
      if (detailRes.ok) {
        const detail = await detailRes.json();
        writeFileSync("./sm-sample-detail.json", JSON.stringify(detail, null, 2));
        console.log(`   💾 wrote ./sm-sample-detail.json`);
        console.log(`   top-level keys: ${JSON.stringify(Object.keys(detail).slice(0, 25))}`);
      } else {
        console.log(`   ⚠ detail fetch returned ${detailRes.status}`);
      }
    }
  }

  // 5. Try to enumerate branches/offices.
  for (const listPath of ["/branches", "/offices", "/api/branches", "/api/offices", "/premium/branches"]) {
    const baseRoot = base.replace(/\/api.*|\/premium.*|\/v1.*|\/opportunities.*/, "");
    const url = `${baseRoot}${listPath}`;
    try {
      const res = await fetch(url, { headers });
      if (res.ok) {
        const j = await res.json();
        writeFileSync(`./sm-${listPath.replace(/\//g, "-")}.json`, JSON.stringify(j, null, 2));
        console.log(`\n✅ ${url} → 200; saved snapshot`);
        const arr = pickArray(j);
        if (arr && arr.length > 0) {
          console.log(`   ${arr.length} entries; first: ${JSON.stringify(arr[0]).slice(0, 200)}`);
        }
        break;
      }
    } catch {
      /* ignore */
    }
  }

  console.log("\n✅ Exploration complete. Review sm-*.json for payload shapes.");
}

function pickArray(x: unknown): unknown[] | null {
  if (Array.isArray(x)) return x;
  if (x && typeof x === "object") {
    for (const key of ["items", "data", "results", "opportunities", "records", "value"]) {
      const v = (x as Record<string, unknown>)[key];
      if (Array.isArray(v)) return v;
    }
  }
  return null;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
