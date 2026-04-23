# CallscraperCRM — Go-Live in 3 Minutes

**Status**: code is deploy-ready. Repo `main` is green. tsc clean. Smoke test
on dev server passes (embed/topbar, login, auth gate, protected routes all
behave correctly). You just need to point Vercel at the repo.

## Fastest path — Vercel Import (web UI, no CLI login needed)

1. Open **https://vercel.com/new** (sign in with GitHub).
2. Click **Import** next to `shan3fr33man-sudo/CallscraperCRM`.
3. **Configure Project**:
   - **Root Directory**: click *Edit* → set to `apps/web` (not the repo root).
   - **Framework Preset**: Next.js (auto-detected).
   - **Build / Install**: leave as-is (already set in `apps/web/vercel.json`).
4. Expand **Environment Variables** and paste these — one per row:

| Name | Where to get the value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `apps/web/.env.local` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `apps/web/.env.local` |
| `SUPABASE_SERVICE_ROLE_KEY` | `apps/web/.env.local` |
| `SUPABASE_PROJECT_REF` | `apps/web/.env.local` |
| `CALLSCRAPER_SUPABASE_URL` | `apps/web/.env.local` |
| `CALLSCRAPER_SUPABASE_ANON_KEY` | `apps/web/.env.local` |
| `CALLSCRAPER_SUPABASE_SERVICE_KEY` | `apps/web/.env.local` |
| `CALLSCRAPER_SUPABASE_SECRET` | `apps/web/.env.local` |
| `ANTHROPIC_API_KEY` | your Anthropic account (optional — per-workspace keys override) |
| `BRIDGE_SIGNING_SECRET` | **generated below** ⬇ |
| `ESTIMATE_SIGNING_SECRET` | **generated below** ⬇ |
| `NEXT_PUBLIC_EMBED_PARENT_ORIGINS` | set to `https://callscraper.com,https://www.callscraper.com` |

5. Click **Deploy**. ~2 minutes later you have a public URL like
   `callscrapercrm.vercel.app`.

## Generated signing secrets (copy these into Vercel)

Fresh 32-byte hex secrets generated for this deploy. Use them verbatim — same
secret in BOTH your CRM and in Ken's callscraper.com so the HMAC bridge
verifies:

```
BRIDGE_SIGNING_SECRET=8233aa8c8874a674309f2b4ac554bf60cf8aaee34a49d74cbd63e0330c31b886
ESTIMATE_SIGNING_SECRET=8f95368fa5b671db5a035df3a632714196fe72c7b0e3bca9970ab89e7eae6aa5
```

> ⚠️ These are in git history as a deploy convenience. Rotate after first
> production traffic by generating new ones with:
> `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

## Post-deploy smoke test

After Vercel gives you a URL (replace `{URL}` below):

```bash
curl -sI {URL}/embed/topbar | grep -i content-security-policy
# expect: frame-ancestors 'self' https://callscraper.com http://localhost:3000 http://localhost:3010

curl -s -o /dev/null -w "%{http_code}\n" {URL}/api/dashboard/unified
# expect: 401  (auth gate works)

curl -s -o /dev/null -w "%{http_code}\n" {URL}/
# expect: 307  (redirect to /login)

curl -s -o /dev/null -w "%{http_code}\n" {URL}/login
# expect: 200
```

If all four pass: live. Sign up via `{URL}/signup` to create your first
workspace.

## Integrations Sprint state at deploy

| Module | Status |
|---|---|
| M1 — TopBar embed (`/embed/topbar`) | ✅ shipped (b6efd72) |
| M2 — Reverse-proxy config | ✅ shipped (CSP + origin allowlist in `next.config.mjs`) |
| M3 — Unified dashboard | ✅ shipped (requireOrgId auth gate) |
| M4 — Session auto-mint + `jti` denylist + org chooser | ⚠️ jti denylist + cookie-handoff chooser shipped; supabase.auth.admin session mint is `TODO v1.2` (user will /login once after landing) |
| M5 — Writeback endpoint (`/api/callscraper/writeback`) | ✅ shipped with UUID injection guard + dynamic overdue query |

## Alternate path — Vercel CLI (if you prefer terminal)

```bash
# one-time
npx vercel login                    # interactive browser flow
cd apps/web && npx vercel link --yes

# add env vars (OR use the web UI per the table above)
for v in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY \
         SUPABASE_SERVICE_ROLE_KEY CALLSCRAPER_SUPABASE_URL \
         CALLSCRAPER_SUPABASE_SERVICE_KEY BRIDGE_SIGNING_SECRET \
         ESTIMATE_SIGNING_SECRET NEXT_PUBLIC_EMBED_PARENT_ORIGINS; do
  npx vercel env add "$v" production
done

# deploy
npx vercel --prod
```

## Notes

- `vercel.json` at `apps/web/` runs install + build from the monorepo root so
  pnpm workspace resolution works.
- `crons` in `vercel.json` only trigger on production deploys — pre-prod URLs
  won't auto-sync from callscraper.
- `.vercel/` is gitignored; every developer links their own clone.
- If the build fails with "lockfile out of date": `pnpm install` at repo root,
  commit `pnpm-lock.yaml`, push.

## Troubleshooting

- **Build fails with `Cannot find module '@callscrapercrm/estimator'`** → the
  pnpm workspace symlinks weren't restored. Fix: `pnpm install` at repo root
  before pushing.
- **Embed page returns 404 when iframed** → check `NEXT_PUBLIC_EMBED_PARENT_ORIGINS`
  is set and includes your parent origin. CSP `frame-ancestors` allowlist is
  defined in `next.config.mjs`; add your custom origin there if it's not
  callscraper.com or localhost.
- **Writeback returns 401 for valid-looking tokens** → `BRIDGE_SIGNING_SECRET`
  in Vercel doesn't match what callscraper.com is signing with. They MUST be
  identical.
- **`/launch` redirects to `/login` always** → by design for v1.1; session
  auto-mint is v1.2. User signs in once after landing, then the bridge flow
  works smoothly on subsequent visits.
