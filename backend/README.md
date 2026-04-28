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
- `DB_DRIVER=sqlite|memory`
- `DB_PATH=./data/football.sqlite`

## SQLite quickstart
```bash
cd backend
DB_DRIVER=sqlite DB_PATH=./data/football.sqlite npm run migrate
DB_DRIVER=sqlite DB_PATH=./data/football.sqlite npm run dev
```

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

> `npm run lint` is currently a placeholder script to verify command availability only (no static lint rules yet).

## HTTP endpoints
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

## Limitations
- No auth/session management.
- No teams/venues/payments/ratings product modules.
- No Telegram UX or Mini App changes beyond backend persistence.
