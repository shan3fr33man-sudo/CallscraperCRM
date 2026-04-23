# Callscraper.com ↔ CallscraperCRM Integration Guide

This document is the contract between **callscraper.com** (Ken's product) and
**CallscraperCRM** (this app) for the "Open in CRM" deep-link and auth
bridge. It is written for Ken so he can implement his side in parallel with
our work, with no back-and-forth needed.

If anything in this doc is ambiguous, stop and ask — don't guess. Changes to
the contract require a PR on both repos.

## Scope (v1.1 Module I1)

- **One-way deep-link** from callscraper.com call cards into the CRM's
  customer detail page, with the caller already authenticated.
- **No reverse-sync** of CRM data back to callscraper.com in this sprint
  (user directive). A dedicated Integration Sprint following this one will
  handle the richer bidirectional surface (shared nav, status badges on call
  cards, real-time dashboard joins).

## Architecture at a glance

```
  callscraper.com/call/123              CRM app (hosted at vercel)
  ┌─────────────────────────┐           ┌────────────────────────────┐
  │  Call detail page       │           │  /launch route             │
  │  "Open in CRM" button   │───POST──▶ │  verifies bridge JWT       │
  │  (mints bridge JWT)     │  /launch  │  looks up org & customer   │
  │                         │  ?t=...   │  302 → /customers/<uuid>   │
  └─────────────────────────┘  &call_id └────────────────────────────┘
                                           │
                                           │ if user has CRM session
                                           ▼
                                         Customer detail page (authed)

                                           or if no CRM session
                                           ▼
                                         /login?next=/customers/<uuid>
```

Reverse-proxy note: when live, `callscraper.com/crm/*` forwards to the CRM
origin via Nginx (config snippet at the bottom of this doc). The user never
sees the CRM subdomain. For dev, Ken can point to the staging Vercel URL
directly and we use CORS-friendly fetch instead.

## The bridge JWT contract

### Shape

```json
{
  "sub":        "callscraper-user-id",        // stable identifier
  "email":      "user@example.com",
  "company_id": "callscraper-workspace-id",   // matches CRM organizations.upstream_company_id
  "iat":        1736802000,                   // issued-at epoch seconds
  "exp":        1736802060,                   // expires-at epoch seconds
  "jti":        "nonce-1234",                 // unique per token
  "call_id":    "optional-call-uuid"          // deep-link context (optional)
}
```

### Required rules

- `sub`, `email`, `company_id`, `iat`, `exp`, `jti` are **required**.
- `exp - iat` **must be ≤ 300 seconds (5 minutes)**. CRM rejects longer
  lifetimes (prevents misuse as a session replacement).
- `iat` must not be more than 60 seconds in the future (clock-skew tolerance).
- `call_id` is optional. If present and the CRM can resolve it to a
  customer, the user lands on that customer's detail page; otherwise on
  the CRM home.

### Token format

Compact HMAC-based envelope (NOT full RFC 7519 JWT — simpler to parse):

```
v1b.<base64url(JSON payload)>.<base64url(HMAC-SHA256 of "v1b.<payload>")>
```

The `v1b` prefix (bridge) is domain-separated from the `v1` prefix used
by the CRM's estimate-signing tokens so a token minted for one system
can never accidentally validate in the other, even when sharing the same
secret in dev environments.

A reference implementation in TypeScript lives at
`apps/web/src/lib/auth-bridge.ts` (see `signBridgeToken` / `verifyBridgeToken`).
Ken's Node.js equivalent:

```js
const { createHmac, randomUUID } = require("node:crypto");

function b64url(buf) {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function signBridgeToken(claims, secret) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: claims.sub,
    email: claims.email,
    company_id: claims.company_id,
    iat: claims.iat ?? now,
    exp: claims.exp ?? now + 60,
    jti: claims.jti ?? randomUUID(),
    ...(claims.call_id ? { call_id: claims.call_id } : {}),
  };
  const payloadB64 = b64url(JSON.stringify(payload));
  // Version prefix `v1b` (bridge) is domain-separated from `v1` estimate
  // tokens so a token minted for one system can never validate in the other.
  const signingInput = `v1b.${payloadB64}`;
  const sig = createHmac("sha256", secret).update(signingInput).digest();
  return `${signingInput}.${b64url(sig)}`;
}

// Usage: signBridgeToken({ sub: user.id, email: user.email, company_id: workspace.id, call_id }, BRIDGE_SIGNING_SECRET)
```

### Shared secret

Both products must configure the same `BRIDGE_SIGNING_SECRET` env var.
Must be **≥ 32 characters** of high-entropy randomness. Generate with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

**Rotation**: change the env var on both products simultaneously. Any
in-flight tokens signed with the old secret will fail validation (users
click "Open in CRM" again with a fresh token — no user action required
on their side).

## Endpoints

### `GET /launch?t=<jwt>&call_id=<uuid>` (public)

The primary deep-link. Called when a user clicks "Open in CRM" on callscraper.

Behavior:
- Validates `t` via the bridge.
- Looks up the organization matching `claims.company_id` via
  `organizations.upstream_company_id`.
- If `call_id` is supplied and resolves to a CRM customer, 307-redirects
  to `/customers/<customer_uuid>`.
- Otherwise 307-redirects to `/`.
- On invalid token: renders an inline error page (no redirect) with
  human-readable detail. This is intentional — a bad token shouldn't
  dump a customer into the CRM login flow with no context.

### `POST /api/auth/exchange` (public)

Server-to-server token validation endpoint. Ken can call this during
testing to verify a freshly-minted token decodes correctly.

Request:
```http
POST /api/auth/exchange
Content-Type: application/json

{ "token": "v1.eyJz...payload...eyJz.sig" }
```

Responses:
- **200 OK**: `{ ok: true, org: { id, name, slug, upstream_company_id }, claims: {...} }`
- **400 Bad Request**: `{ ok: false, error: "token required" }` when body missing
- **401 Unauthorized**: `{ ok: false, error: "Invalid bridge token", reason: "<specific-reason>" }`
  Reason values: `missing`, `too_long`, `malformed`, `wrong_version`,
  `bad_encoding`, `bad_signature`, `expired`, `future_iat`, `ttl_too_long`,
  `missing_claim`, `no_secret`.
- **404 Not Found**: `{ ok: false, error: "No CRM workspace linked ..." }`
  when `company_id` has no matching CRM org. User needs to link via CRM
  Settings → Integrations → Callscraper (v1.2 UI).
- **409 Conflict**: `{ ok: false, error: "Multiple ...", matches: [...orgs] }`
  when multiple CRM orgs are linked to the same callscraper company_id
  (legitimate — see migration 0009). Chooser UI lands in v1.2.

## Workspace linking

The CRM stores the link in `organizations.upstream_company_id`:

- **Nullable**: standalone CRM installs (no callscraper) leave this null.
- **Non-unique**: one callscraper workspace MAY map to multiple CRM orgs.
  This supports regional franchise topologies where one brand-level
  callscraper account feeds several CRM tenants. v1.1 resolves ties by
  picking the first match deterministically (order not guaranteed); v1.2
  adds a chooser UI.

To establish the link during pilot testing, run a SQL statement in the CRM
Supabase console (`kxhqxrmroreuglvsatkn`):

```sql
UPDATE organizations
SET upstream_company_id = '<callscraper-company-id>'
WHERE id = '<crm-org-id>';
```

A proper Settings → Integrations → Callscraper UI lands in v1.2.

## Call_id resolution

When `call_id` is present in the token, the `/launch` page looks it up via:

```sql
SELECT record_id FROM activities
WHERE org_id = <resolved-org-id>
  AND kind = 'call'
  AND payload->>'external_id' = <call_id>
LIMIT 1;
```

`record_id` is the CRM customer UUID. This relies on the existing
callscraper sync (`/api/sync/callscraper`, every 15 min) having already
ingested the call into `activities`. If a call is brand-new (< 15 min old),
the deep-link may land on `/` instead of the specific customer. v1.2 will
add a real-time fallback that queries upstream directly.

## Session handling (what this sprint does NOT do)

The `/launch` page validates the bridge token but does **not** yet mint a
CRM Supabase Auth session on the user's behalf. Behavior when the user
lands:

- If already logged into the CRM in this browser → seamless redirect to
  `/customers/<id>`.
- If not logged in → middleware redirects to `/login?next=/customers/<id>`.

That's acceptable for a pilot — one login per session while we stabilize
the contract. The dedicated Integration Sprint (post-this-sprint, pre-Stripe)
will add:

- Auto-mint a CRM Supabase session from bridge claims (via
  `supabase.auth.admin.createUser` + `generateLink`)
- Chooser UI when multiple orgs match the upstream_company_id
- Single-use token replay protection via a `bridge_jti_denylist` table

## Reverse proxy (production Nginx)

When the CRM is live at `callscraper.com/crm`, Ken's Nginx config:

```nginx
location /crm/ {
    # Strip the /crm prefix before forwarding so CRM routes resolve correctly
    rewrite ^/crm/(.*)$ /$1 break;
    proxy_pass https://<crm-origin>;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    # Preserve cookies for the CRM's Supabase session
    proxy_pass_header Set-Cookie;
    proxy_cookie_path / /crm/;
    # Rewrite absolute-URL redirects so a CRM 302 to `/customers/<id>`
    # doesn't escape the /crm prefix and land outside the proxied area.
    proxy_redirect https://<crm-origin>/ /crm/;
    # Keep the bridge JWT query param untouched
    proxy_set_header X-Forwarded-Uri $request_uri;
}
```

For development against the staging Vercel URL, Ken can link directly
(`https://<staging-url>/launch?...`) without proxy config.

## Test vectors

A round-trip integration test lives at
`apps/web/src/lib/__tests__/auth-bridge.test.ts` (17 unit tests covering
sign/verify, tamper rejection, expiry, TTL caps, secret rotation, and
dev-mode gating). Run with:

```bash
node --experimental-strip-types --test apps/web/src/lib/__tests__/auth-bridge.test.ts
```

Ken can reuse the exact test vectors in his own test suite.

## Checklist for Ken's side

- [ ] Add `BRIDGE_SIGNING_SECRET` env var to callscraper.com's env (≥ 32 chars)
- [ ] Implement `signBridgeToken()` using the snippet above (or port from
      `apps/web/src/lib/auth-bridge.ts`)
- [ ] Add an "Open in CRM" button to each call card. On click:
  1. Call backend: `POST /internal/mint-crm-token { call_id }` (Ken's route)
  2. Backend returns `{ token, url: "/crm/launch?t=<token>&call_id=<id>" }`
  3. `window.location.href = url`
- [ ] For the pilot, configure the Nginx proxy or use a direct Vercel URL
- [ ] Verify in dev: click button → lands in CRM with correct customer selected

## Writeback endpoint

Reverse direction from the bridge: callscraper.com asks the CRM "what's the
status of call X?" and the CRM responds with a badge list that callscraper
renders on its call card. This is the surface that unlocks shared status
without shared auth.

### Endpoint

`POST /api/callscraper/writeback?t=<v1w_token>`

- **Always JSON**, with `cache-control: no-store`.
- **Body** (optional — the token carries the authoritative `call_id`):
  ```json
  { "call_id": "<callscraper-call-uuid>" }
  ```
  If the body's `call_id` is present and does not match the token, the
  endpoint rejects with 401 (cross-binding guard).

### Response

```json
{
  "badges": [
    { "label": "Booked · $2,450", "tone": "green", "link": "/customers/<uuid>" },
    { "label": "Overdue invoice",  "tone": "red",   "link": "/customers/<uuid>" }
  ]
}
```

- `tone` is one of: `green | red | amber | blue | muted`.
- `link` is optional (CRM-relative path). Callscraper may compose it with
  the `/crm/` reverse-proxy prefix so clicks land on the right page.
- Max 3 badges. Empty array is a valid response — render a neutral card.
- Badge composition rules (subject to change; stable within v1):
  - Opportunity → `booked` ⇒ green "Booked · $X" (X = max amount); else
    `quoted` ⇒ blue "Quoted · $X"; else any ⇒ blue "Active opportunity".
  - Invoice with `status='overdue'` ⇒ red "Overdue invoice".
  - Tickets with `status='active'` and `priority >= 3` ⇒ amber "N open tickets".

### Error codes

- **200 OK**: always, including when zero badges apply or the call isn't
  in the CRM yet (sync window — treat as empty badges, not an error).
- **401 Unauthorized**: bad, expired, or cross-bound token. Coarse reason
  only — specific `reason` codes are logged server-side but never returned.
- **404 Not Found**: the token's `company_id` does not map to any CRM org.
  The callscraper workspace hasn't been linked yet (see Workspace linking
  above).

### Token format

Same HMAC envelope as the bridge, but with a distinct version prefix so the
domains cannot cross:

```
v1w.<base64url(JSON payload)>.<base64url(HMAC-SHA256 of "v1w.<payload>")>
```

- **Prefix**: `v1w.` (writeback). Domain-separated from `v1b.` bridge tokens
  and `v1.` estimate tokens — a token minted for one surface can NEVER
  validate on another, even though they share the secret.
- **TTL**: 5 minutes max (same cap as bridge). Default 60s.
- **Payload**:
  ```json
  { "call_id": "...", "company_id": "...", "exp": 1736802060 }
  ```
  No user identity (`sub`/`email`/`jti`) — this is system-to-system.
- **Signing secret**: same `BRIDGE_SIGNING_SECRET` env var as the bridge.
  Rotating the bridge secret rotates writeback at the same time, which is
  the intended behavior.

### Reference implementation (Node.js)

Mirrors the bridge snippet above but emits the `v1w.` prefix and a reduced
claims set:

```js
const { createHmac } = require("node:crypto");

function b64url(buf) {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function signWritebackToken(claims, secret) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    call_id: claims.call_id,
    company_id: claims.company_id,
    exp: claims.exp ?? now + 60,
  };
  const payloadB64 = b64url(JSON.stringify(payload));
  // Version prefix `v1w` (writeback) is domain-separated from `v1b` bridge
  // and `v1` estimate tokens.
  const signingInput = `v1w.${payloadB64}`;
  const sig = createHmac("sha256", secret).update(signingInput).digest();
  return `${signingInput}.${b64url(sig)}`;
}

// Usage:
//   const token = signWritebackToken(
//     { call_id: call.id, company_id: workspace.id },
//     process.env.BRIDGE_SIGNING_SECRET
//   );
//   const res = await fetch(`https://<crm>/api/callscraper/writeback?t=${token}`, {
//     method: "POST",
//     headers: { "content-type": "application/json" },
//     body: JSON.stringify({ call_id: call.id }),
//   });
//   const { badges } = await res.json();
```

The CRM's authoritative verifier lives at
`apps/web/src/lib/auth-bridge.ts` (`signWritebackToken` /
`verifyWritebackToken`). Ken can port the logic verbatim.

## Things NOT in v1.1 (tracked for the Integration Sprint)

- Reverse sync (CRM → callscraper badges on call cards)
- Shared top-bar nav / unified layout
- Real-time call → customer resolution (for calls < 15 min old)
- Admin UI for mapping callscraper company_id ↔ CRM org_id
- Auto-mint CRM session from bridge JWT
- Multiple-org chooser UI

Questions, problems, ambiguities → file an issue against this doc.

— Shane
