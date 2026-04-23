/**
 * PM2 ecosystem config for CallscraperCRM workers on Hostinger VPS.
 *
 * Two long-running processes:
 *   1. worker-loop    — the plugin-ingestion loop (existing).
 *   2. cs-subscriber  — Supabase realtime listener → CRM webhook producer.
 *
 * Start everything:
 *   pm2 start ecosystem.config.js
 *   pm2 save
 *   pm2 startup            # enable boot-time auto-start
 *
 * Env values below are placeholders. The REAL values live in:
 *   - /etc/callscraper/env.production (chmod 600, root:root)
 *   OR
 *   - PM2 secrets:  pm2 set callscraper:SMARTMOVING_API_KEY '<value>'
 *
 * Never commit real secrets into this file. When this file loads, PM2
 * merges `env_production` over the process's baseline environment, so secrets
 * pulled from `/etc/callscraper/env.production` (via `dotenv-cli` in a
 * wrapper) take precedence.
 */
module.exports = {
  apps: [
    {
      name: "worker-loop",
      cwd: "./apps/worker",
      script: "tsx",
      args: "src/index.ts",
      interpreter: "none",
      watch: false,
      autorestart: true,
      max_memory_restart: "512M",
      exp_backoff_restart_delay: 1000,
      env_production: {
        NODE_ENV: "production",
        // Populated from /etc/callscraper/env.production at boot.
      },
    },
    {
      name: "cs-subscriber",
      cwd: "./apps/worker",
      script: "tsx",
      args: "src/jobs/callscraper-subscriber.ts",
      interpreter: "none",
      watch: false,
      autorestart: true,
      max_memory_restart: "512M",
      exp_backoff_restart_delay: 2000,
      // Graceful shutdown — subscriber's SIGTERM handler unsubscribes the
      // realtime channel cleanly before exit.
      kill_timeout: 10000,
      env_production: {
        NODE_ENV: "production",
      },
    },
  ],
};
