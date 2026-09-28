# my-app

A Cloudflare Worker + Hono + React server-rendered app scaffold.

## Structure

- `src/worker` - Hono entrypoint and Worker bootstrap
- `src/routes` - route modules and API endpoints
- `src/rsc` - React Server Components area
- `src/components` - shared UI components
- `src/lib` - KV/cache and utils
- `tests/unit` - Vitest unit tests
- `tests/integration` - HTTP integration tests
- `tests/e2e` - Playwright smoke tests

## Data and auth

The D1 migrations are in `migrations/`. `0001_initial.sql` creates `users` and `auth_sessions`; `0002_chat_admin.sql` adds account status and persisted chat messages; `0003_sensor_readings.sql` adds sensor telemetry storage.

```bash
npx wrangler d1 create my-app-db
npx wrangler d1 migrations apply my-app-db --local
npx wrangler d1 migrations apply my-app-db --remote
npx wrangler secret put JWT_SECRET
```

Auth endpoints:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`

Login issues an HttpOnly `session` cookie containing an HMAC-SHA256 JWT. The JWT points to an opaque session stored by `AuthSessionDurableObject`; logout revokes the D1 record and deletes the Durable Object session.

Real-time rooms use `GET /api/realtime/:room` with an authenticated WebSocket upgrade. `RealtimeRoomDurableObject` stores messages in D1 and broadcasts them to every connected client in that room.

## Dashboard features

After login, the browser opens `/dashboard`. Signed-in users can chat in the `general` room and view recent messages stored in D1.

- `GET /api/chat/:room/messages` returns recent messages for an authenticated user.
- `GET /api/realtime/:room` upgrades an authenticated request to WebSocket.
- `GET /api/admin/users` lists accounts for admins.
- `PATCH /api/admin/users/:userId/status` enables or disables an account; the signed-in admin cannot disable their own account.

New accounts are regular users by default. Assign the `admin` role through a trusted administrative process; do not expose role assignment in public registration.

## Sensor telemetry

Signed-in users can open `/sensors` to view the latest temperature, stepper state, servo angle, temperature trend, and recent D1 history. The page also includes a form for recording test/manual readings.

- `GET /api/sensors/readings?limit=30` lists recent records (limit 1-100).
- `POST /api/sensors/readings` records a reading; requests require the session cookie.

Example request body:

```json
{
  "deviceId": "bench-01",
  "temperatureC": 24.7,
  "stepperStatus": "moving",
  "servoAngle": 92
}
```

Temperature is limited to -40 through 125 °C, servo angle to 0 through 180°, and stepper status to `stopped`, `moving`, or `error`. A hardware client must authenticate and send the session cookie before posting readings.

## Browser auth UX

The home page now renders a real login/register panel and session status area. The browser calls the API endpoints directly and manages the auth cookie automatically.

## Local Docker stack

```bash
docker compose up --build
```

This starts the Node app in a local container on port `5173`. The project also includes a Postgres service for local Hyperdrive-style testing, while Cloudflare D1 remains managed through Wrangler.

## Scripts

- `npm install`
- `npm run dev`
- `npm run build`
- `npm test`
- `npx playwright test`
- `npm run docker:up`
- `npm run docker:down`

## Cloudflare setup

Update `wrangler.jsonc` with:

- KV namespace id
- D1 database id
- Durable Object binding configuration

Hyperdrive is not configured for the first Cloudflare deployment; the application currently uses D1 for persistent data. Add a Hyperdrive binding only after providing a PostgreSQL endpoint reachable by Cloudflare.

Then run:

```bash
npx wrangler d1 create my-app-db
npx wrangler kv:namespace create CACHE
npx wrangler deploy
```
