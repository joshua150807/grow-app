# Grow Backend

Fastify backend for the Grow production release. This service is the backend boundary for validation, authorization, business logic, logging, Supabase access, creator flows, video moderation, and the KI Mentor.

## Setup

From the monorepo root:

```bash
npm install
```

Run API commands through the npm workspace:

```bash
npm run dev:api
npm run build:api
npm run test:api
npm run typecheck:api
```

Or from the API package directly:

```bash
cd apps/api
npm run dev
npm run build
npm test
npm run test:watch
npm run typecheck
```

Fill `apps/api/.env` with server-only values when a route actually needs them. Never commit real secrets. The Supabase service role key and PostgreSQL credentials must never be exposed to the mobile app.

Required for Supabase Auth token verification:

```txt
SUPABASE_URL=
SUPABASE_ANON_KEY=
```

Required for the real runtime `GET /v1/profile/me` Drizzle read path:

```txt
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
```

Reserved for Supabase admin/repository access used by existing Supabase-backed routes:

```txt
SUPABASE_SERVICE_ROLE_KEY=
```

`npm run build:api`, `npm run typecheck:api`, and `npm run test:api` do not require `DATABASE_URL` because the PostgreSQL client is lazy. A real runtime `GET /v1/profile/me` request does require server-side `DATABASE_URL`.

## Current Routes

- `GET /v1/health` returns backend health information.
- `GET /v1/me` verifies `Authorization: Bearer <supabase-access-token>` and returns basic auth user data. It does not load the `profiles` table yet.
- `GET /v1/profile/me` verifies `Authorization: Bearer <supabase-access-token>`, uses the authenticated `user.id` as the only profile id, and reads the profile through Drizzle/PostgreSQL in the real runtime. Missing profiles return `404 PROFILE_NOT_FOUND`.
- `PATCH /v1/profile/me` verifies `Authorization: Bearer <supabase-access-token>`, validates profile fields, stays on the existing Supabase-backed path, updates only the authenticated user's profile, and returns the updated profile.
- `GET /v1/creator/applications/me` verifies `Authorization: Bearer <supabase-access-token>` and returns the authenticated user's latest creator application status. If no application exists, it returns `{ "status": "none", "application": null }`.
- `POST /v1/creator/applications` verifies `Authorization: Bearer <supabase-access-token>`, validates the creator application, creates it for the authenticated user only, and returns `201`. Open existing applications return `409 CREATOR_APPLICATION_EXISTS`.
- `GET /v1/admin/creator/applications` verifies `Authorization: Bearer <supabase-access-token>`, requires an authenticated `admin` or `ceo` role server-side, and lists creator applications with optional `status`, `limit`, and `page` query filters.
- `PATCH /v1/admin/creator/applications/:id` verifies `Authorization: Bearer <supabase-access-token>`, requires an authenticated `admin` or `ceo` role server-side, and approves or rejects a pending/requested creator application atomically through `public.review_creator_application`.

Test `/v1/me` locally with a real Supabase access token from the mobile app session:

```bash
curl http://127.0.0.1:4000/v1/me \
  -H "Authorization: Bearer YOUR_SUPABASE_ACCESS_TOKEN"
```

Test `/v1/profile/me` locally:

```bash
curl http://127.0.0.1:4000/v1/profile/me \
  -H "Authorization: Bearer YOUR_SUPABASE_ACCESS_TOKEN"
```

`GET /v1/profile/me` returns:

```json
{
  "profile": {
    "id": "USER_ID",
    "username": "grower_01",
    "grow_points": 0,
    "role": "user",
    "created_at": "2026-07-05T10:00:00.000Z",
    "updated_at": "2026-07-05T11:00:00.000Z"
  }
}
```

Update `/v1/profile/me` locally:

```bash
curl -X PATCH http://127.0.0.1:4000/v1/profile/me \
  -H "Authorization: Bearer YOUR_SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"grower_01\",\"display_name\":\"Grower\"}"
```

Create a creator application locally:

```bash
curl -X POST http://127.0.0.1:4000/v1/creator/applications \
  -H "Authorization: Bearer YOUR_SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"motivation\":\"I want to create practical growth videos for the Grow community.\",\"experience\":\"I have created short-form educational content before.\",\"content_focus\":\"Mindset, discipline and fitness.\",\"social_links\":[\"https://example.com/grower\"]}"
```

Check your creator application status locally:

```bash
curl http://127.0.0.1:4000/v1/creator/applications/me \
  -H "Authorization: Bearer YOUR_SUPABASE_ACCESS_TOKEN"
```

List creator applications as an admin or CEO:

```bash
curl "http://127.0.0.1:4000/v1/admin/creator/applications?status=pending&limit=25&page=0" \
  -H "Authorization: Bearer YOUR_SUPABASE_ACCESS_TOKEN"
```

Approve a creator application as an admin or CEO:

```bash
curl -X PATCH http://127.0.0.1:4000/v1/admin/creator/applications/APPLICATION_ID \
  -H "Authorization: Bearer YOUR_SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"decision\":\"approved\"}"
```

Reject a creator application as an admin or CEO:

```bash
curl -X PATCH http://127.0.0.1:4000/v1/admin/creator/applications/APPLICATION_ID \
  -H "Authorization: Bearer YOUR_SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"decision\":\"rejected\",\"rejection_reason\":\"Please add a clearer content focus.\"}"
```

## PostgreSQL Integration Test

The profile Drizzle read repository has a real local PostgreSQL integration test backed by `docker-compose.test.yml`. It uses a dedicated local database named `grow_api_integration_test` on `127.0.0.1:55432`.

Start the isolated test database:

```powershell
docker compose -f docker-compose.test.yml up -d
```

Check health/status:

```powershell
docker compose -f docker-compose.test.yml ps
```

Run the integration test with process-local test environment values only:

```powershell
$env:TEST_DATABASE_URL="postgresql://grow_test:grow_test_password@127.0.0.1:55432/grow_api_integration_test"
$env:ALLOW_INTEGRATION_DB_RESET="true"
npm --workspace @grow/api run test:integration
```

Always remove the test database afterwards:

```powershell
docker compose -f docker-compose.test.yml down -v
```

Safety notes:

- The integration test is guarded to accept only `TEST_DATABASE_URL`.
- It never falls back to `DATABASE_URL`.
- The database name must be exactly `grow_api_integration_test`.
- `ALLOW_INTEGRATION_DB_RESET=true` is required before destructive test setup runs.
- Never point the integration test at Live Supabase or any production database.

## Structure

```txt
apps/api/
  src/
    app.ts
    server.ts
    config/
    db/
    errors/
    integrations/
    logger/
    middleware/
    modules/
    routes/
    validation/
  tests/
```

## Notes

- Supabase Auth remains responsible for access-token verification.
- `GET /v1/profile/me` uses Drizzle/PostgreSQL for the runtime read path.
- `PATCH /v1/profile/me` and Creator routes remain on existing Supabase-backed repositories.
- Service role usage stays server-side only and must never be exposed to the mobile app.
- API routes are versioned under `/v1` to reduce EAS Updates compatibility risk.
- Creator application approval uses the `public.review_creator_application` RPC from `supabase/migrations/20260630164000_creator_system_v1.sql`. The backend must keep calling `requireAdminOrCeo` before invoking this RPC because the RPC receives `input_reviewer_id` from the backend and is intended for service-role use only.
