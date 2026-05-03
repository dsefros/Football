# Telegram-first football matching MVP backend skeleton

## Scope kept
- users, requests, responses
- status events
- token-based Telegram callbacks
- deep-link open request
- active requests + my requests
- request create/patch/publish/close/cancel
- response create/accept/decline/cancel

## Storage modes
- `DB_DRIVER=memory` (default): runtime state is in-memory Maps and resets on restart.
- `DB_DRIVER=sqlite`: runtime state is persisted to SQLite file defined by `DB_PATH`.

### Environment
1. Create local config: `cp .env.example .env`.
2. Edit `.env` values for your machine.
3. Runtime priority: existing shell `process.env` values override `.env` file values.

Key variables:
- `PORT=3010`
- `DB_DRIVER=sqlite|memory`
- `DB_PATH=./data/football.sqlite`
- `TELEGRAM_BOT_TOKEN=...`
- `TELEGRAM_BOT_USERNAME=FootballMvpBot`
- `PUBLIC_BASE_URL=https://...`
- `TELEGRAM_TRANSPORT_ENABLED=true|false`

## SQLite quickstart
```bash
cd backend
npm run migrate
npm run dev
```

## Operational checks
```bash
cd backend
npm run smoke
BASE_URL=http://localhost:3010 npm run smoke
```

## Health
- Endpoint: `GET /health`
- Purpose: process liveness only (HTTP router/server is reachable).
- It does **not** run DB queries.

Example response:
```json
{
  "ok": true,
  "service": "football-backend",
  "storage": "memory",
  "timestamp": "2026-04-28T00:00:00.000Z"
}
```

## Readiness
- Endpoint: `GET /ready`
- Purpose: repository + database readiness.
- Memory mode: validates repositories are initialized.
- SQLite mode: validates connection (`SELECT 1`) and migration state.
- Failure returns HTTP `503` with a structured error body.

## SQLite backup
Run app in sqlite mode:
```bash
DB_DRIVER=sqlite DB_PATH=./data/football.sqlite npm run dev
```

Create backup:
```bash
DB_PATH=./data/football.sqlite BACKUP_DIR=./backups npm run backup:sqlite
```

- Uses `sqlite3` CLI `.backup` command (safe SQLite backup flow).
- Runs `PRAGMA integrity_check` on the backup file.
- Fails if source DB is missing or if `sqlite3` is unavailable.
- Requires `sqlite3` CLI to be installed.
- Ubuntu/WSL install:
  ```bash
  sudo apt update
  sudo apt install -y sqlite3
  ```

## SQLite files
When running with WAL mode, SQLite creates:
- `football.sqlite`
- `football.sqlite-wal`
- `football.sqlite-shm`

These are runtime artifacts and must not be committed to git.

## Graceful shutdown
- On `Ctrl+C` (`SIGINT`) or `SIGTERM`, server performs graceful shutdown:
  - stop accepting new HTTP connections
  - close HTTP server
  - close DB handle via `app.close()`
- Successful shutdown exits with code `0`; failures exit with code `1`.

## Restart persistence check
1. Run server in sqlite mode and create/publish request + accept response.
2. Stop and start again with the same `DB_PATH`.
3. Verify data still exists via endpoints such as:
   - `GET /requests/:request_id`
   - `GET /requests/active`
   - `GET /users/:user_id/requests`

## Migrations
- SQL migrations live in `src/db/migrations/*.sql` and run in lexicographic order.
- Runtime migration engine creates `schema_migrations(id, applied_at)` and applies each migration once.
- In `memory` mode, `npm run migrate` reports discovered migration files but does not apply SQL.

## Scripts
- `npm test`
- `npm run migrate`
- `npm run lint`
- `npm run dev`
- `npm run dev:sqlite`
- `npm run test:sqlite`
- `npm run smoke`
- `npm run smoke:sqlite`
- `npm run backup:sqlite`

> `npm run lint` is currently a placeholder script to verify command availability only (no static lint rules yet).

## HTTP endpoints
- `GET /health`
- `GET /ready`
- `POST /telegram/webhook`
- `POST /users/telegram-upsert`
- `GET /users/:user_id/requests`
- `POST /requests`
- `PATCH /requests/:request_id`
- `POST /requests/:request_id/publish`
- `GET /requests/active`
- `GET /requests/:request_id`
- `GET /requests/by-token/:share_token`
- `POST /requests/:request_id/close`
- `POST /requests/:request_id/cancel`
- `POST /requests/:request_id/responses`
- `GET /requests/:request_id/responses`
- `POST /responses/:response_id/accept`
- `POST /responses/:response_id/decline`
- `POST /responses/:response_id/cancel-by-user`
- `POST /responses/:response_id/cancel-by-author`
- `POST /jobs/expire-requests`

## Telegram rules implemented
- Deep link payload format: `/start r_<share_token>`.
- Callback data format: `t_<short_token>`.
- Callback tokens are validated for existence, expiry, single use, and actor mismatch.

## Contact visibility
- Before ACCEPTED: only display_name may be visible; telegram_username hidden.
- After ACCEPTED: both request_author and response_author include display_name + telegram_username.

## Known limitations
- No auth/session management.
- No production process manager yet.
- No Docker deployment yet.
- No PostgreSQL support.
- No teams/venues/payments/ratings product modules.
- No Telegram UX or Mini App changes beyond backend persistence.
- `node:sqlite` warning/availability may vary depending on Node version/runtime.
- `npm run lint` remains a placeholder.

## Telegram webhook transport
- This backend uses **webhook-only Telegram transport** (no polling in this project).
- Production-grade Docker/deployment hardening is still out of scope for now.

### Telegram environment variables
- `TELEGRAM_BOT_TOKEN=<your_bot_token>`
- `TELEGRAM_BOT_USERNAME=<your_bot_username_without_@>`

### Webhook setup
```bash
curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" -d "url=$PUBLIC_BASE_URL/telegram/webhook" | jq
```

### Webhook status check
```bash
curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo" | jq
```

### Local tunnel examples
```bash
# ngrok
ngrok http 3010

# cloudflared
cloudflared tunnel --url http://localhost:3010
```

Then use tunnel HTTPS URL as `PUBLIC_BASE_URL` in `setWebhook`.

### Local run with Telegram transport
```bash
cd backend
PORT=3010 DB_DRIVER=sqlite DB_PATH=./data/football.sqlite TELEGRAM_BOT_TOKEN=... TELEGRAM_BOT_USERNAME=... npm run dev
```


## Telegram webhook notes
- Configure webhook with `PUBLIC_BASE_URL` and `TELEGRAM_BOT_TOKEN`.
- Tunnels from ngrok/cloudflared are temporary. Every URL change requires re-running `setWebhook` with the new HTTPS URL.

## Auth and transactions
- `API_AUTH_MODE=dev-header|disabled` (default `dev-header`). In `dev-header`, protected HTTP routes require `X-Actor-User-Id`.
- Protected routes derive actor only from auth context; body/query actor ids are ignored for authorization.
- `POST /jobs/expire-requests` now requires authenticated actor, but still lacks role/admin guard.
- Lifecycle multi-write operations are wrapped in DB transactions. SQLite uses real BEGIN/COMMIT/ROLLBACK; memory driver runs best-effort transaction callback without rollback semantics.
- Telegram request creation wizard is button-first for controlled fields (count/date/time/zone/format/level/payment/position) via callback-token buttons; free text is optional for future comment/location/payment-note extensions.
