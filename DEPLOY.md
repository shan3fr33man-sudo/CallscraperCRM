# CallscraperCRM — Vercel Deploy Cheat Sheet

The Next.js app lives at `apps/web/`. This is a pnpm monorepo. Vercel is configured via `apps/web/vercel.json` (build/install commands run from the repo root).

## a. First-time setup

Run these once per machine / project:

```bash
# 1. Authenticate the Vercel CLI (interactive — opens browser)
npx vercel login

# 2. Link the local app directory to a Vercel project
cd apps/web
npx vercel link
# Accept defaults, or pick an existing project. The .vercel/ dir that gets
# created is gitignored and stores the project/org IDs.

# 3. Push env vars to Vercel. Either:
#    (a) Paste them in the Vercel Dashboard:
#        Project -> Settings -> Environment Variables
#        (use apps/web/.env.production.example as the list)
#    — or —
#    (b) Add them one-by-one via CLI (still from apps/web):
npx vercel env add NEXT_PUBLIC_SUPABASE_URL production
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
npx vercel env add SUPABASE_SERVICE_ROLE_KEY production
npx vercel env add SUPABASE_PROJECT_REF production
npx vercel env add CALLSCRAPER_SUPABASE_URL production
npx vercel env add CALLSCRAPER_SUPABASE_ANON_KEY production
npx vercel env add CALLSCRAPER_SUPABASE_PUBLISHABLE_KEY production
npx vercel env add CALLSCRAPER_SUPABASE_SERVICE_KEY production
npx vercel env add CALLSCRAPER_SUPABASE_SECRET production
npx vercel env add ANTHROPIC_API_KEY production
npx vercel env add BRIDGE_SIGNING_SECRET production
npx vercel env add ESTIMATE_SIGNING_SECRET production
npx vercel env add NEXT_PUBLIC_EMBED_PARENT_ORIGINS production
# Repeat with `preview` and `development` targets if you want them there too.
```

## b. Deploy a preview build

Creates a throwaway preview URL (great for PR previews / sanity checks):

```bash
cd apps/web
npx vercel
```

## c. Deploy to production

Promotes the build to the primary domain:

```bash
cd apps/web
npx vercel --prod
```

## Notes

- `vercel.json` sets `framework: nextjs` and overrides build/install to run from the monorepo root so pnpm workspace resolution works.
- The `crons` in `vercel.json` only trigger on production deploys.
- The `.vercel/` directory is gitignored — every developer links their own clone.
- If builds fail with "lockfile out of date", regenerate with `pnpm install` at the repo root and commit `pnpm-lock.yaml`.
