# Telegram-first football matching MVP backend skeleton

## Scope kept
- users, requests, responses
- status events
- token-based Telegram callbacks
- deep-link open request
- active requests + my requests
- request create/patch/publish/close/cancel
- response create/accept/decline/cancel

## Storage mode
- Runtime and tests use in-memory repositories.
- SQL migration schema is included in `src/db/migrations/001_init.sql` for future SQLite integration.
- `npm run migrate` is explicit no-op in this skeleton (lists migration files only).

## Scripts
- `npm test`
- `npm run migrate`
- `npm run lint`
- `npm run dev`

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
