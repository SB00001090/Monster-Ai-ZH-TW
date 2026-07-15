# Guardian Ai — API Integration

**Base URL:** `https://<your-tunnel>.trycloudflare.com` (Cloudflare Tunnel HTTPS only)

Developed by Suckbob | Guardian Ai

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Liveness |
| GET | `/api/guardian/status` | Platform status (`no_tailscale`, `no_qr_code`) |
| GET | `/api/guardian/connection` | Tunnel + USB connection info |
| GET | `/api/guardian/disclaimer` | Hardcoded disclaimer (cannot disable) |
| POST | `/api/guardian/sync/upload` | E2E encrypted cloud sync upload |
| POST | `/api/guardian/sync/download` | E2E encrypted cloud sync restore |
| GET | `/api/guardian/network-learning/status` | Background learning status (opt-in) |
| POST | `/api/guardian/network-learning/consent` | Grant/revoke network learning consent |
| POST | `/api/guardian/errors/report` | Error learning + Discord report |

## Android client stack

- **OkHttp** + `RetryInterceptor` (3 retries)
- **Retrofit** `MonsterApiService` (Guardian endpoints)
- **GuardianSyncClient** — E2E sync bundles
- **WorkManager** — `GuardianSyncWorker`, health probe
- **Offline cache** — `last_health.json`

## Dify / Make / Sentry

- Dify: `deploy/dify/workflow_guardian.json`
- Make: `deploy/make/SCENARIO.md`
- Sentry: `client/src/lib/sentry.ts` + backend `integrations.sentry_dsn`