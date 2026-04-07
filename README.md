# CallscraperCRM

Open-source, AI-native CRM for builders. Fully customizable, plugin-driven, and designed to integrate seamlessly with **anything** — REST, webhooks, shared DB, or scraping.

First-class integration with [callscraper.com](https://callscraper.com).

## Stack
- Next.js 15 (App Router) + shadcn/ui + Tailwind
- Supabase (Postgres + Auth + Storage + Realtime + pgvector)
- Claude Agent SDK for the AI layer
- pnpm + Turborepo monorepo

## Layout
```
apps/web        Next.js dashboard
apps/worker     Background ingestion + AI jobs
packages/core   Domain types & schemas
packages/db     Supabase migrations
packages/sdk    Public TS client
packages/plugin-sdk  Plugin contract + adapters
packages/ai     Claude wrappers + tool registry
plugins/callscraper  First-party callscraper.com plugin (REST + webhook + FDW + scraper)
```

## Quickstart
```bash
pnpm install
cp .env.example .env.local   # fill in keys
pnpm dev
```

## License
MIT
