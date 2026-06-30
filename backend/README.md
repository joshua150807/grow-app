# Grow Backend

Fastify backend skeleton for the Grow production release. This service is the future boundary for validation, authorization, business logic, logging, Supabase access, creator uploads, video moderation, and the KI Mentor.

## Setup

```bash
cd backend
npm install
cp .env.example .env
```

Fill `.env` with server-only values when a route actually needs them. The Supabase service role key must never be exposed to the mobile app.

Required for Supabase Auth token verification:

```txt
SUPABASE_URL=
SUPABASE_ANON_KEY=
```

Reserved for later repository/admin access:

```txt
SUPABASE_SERVICE_ROLE_KEY=
```

## Scripts

```bash
npm run dev
npm run build
npm start
npm test
npm run test:watch
npm run typecheck
```

## Local Development

```bash
cd backend
npm run dev
```

The default local URL is:

```txt
http://127.0.0.1:4000/v1/health
```

## Current Routes

- `GET /v1/health` returns backend health information.
- `GET /v1/me` verifies `Authorization: Bearer <supabase-access-token>` and returns basic auth user data. It does not load the `profiles` table yet.
- `GET /v1/profile/me` verifies `Authorization: Bearer <supabase-access-token>` and returns the authenticated user's profile. It never accepts a user id from query/body. Missing profiles return `404 PROFILE_NOT_FOUND` so the client can show a defined setup/empty state without the read route creating data.
- `PATCH /v1/profile/me` verifies `Authorization: Bearer <supabase-access-token>`, validates profile fields, updates only the authenticated user's profile, and returns the updated profile.
- `GET /v1/creator/applications/me` verifies `Authorization: Bearer <supabase-access-token>` and returns the authenticated user's latest creator application status. If no application exists, it returns `{ "status": "none", "application": null }`.
- `POST /v1/creator/applications` verifies `Authorization: Bearer <supabase-access-token>`, validates the creator application, creates it for the authenticated user only, and returns `201`. Open existing applications return `409 CREATOR_APPLICATION_EXISTS`.
- `GET /v1/admin/creator/applications` verifies `Authorization: Bearer <supabase-access-token>`, requires an authenticated `admin` or `ceo` role server-side, and lists creator applications with optional `status`, `limit`, and `page` query filters.
- `PATCH /v1/admin/creator/applications/:id` verifies `Authorization: Bearer <supabase-access-token>`, requires an authenticated `admin` or `ceo` role server-side, and approves or rejects a pending/requested creator application.

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

## Structure

```txt
src/
  app.ts
  server.ts
  config/
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

- Supabase Admin Client is prepared in `src/integrations/supabase/adminClient.ts`, but no production route uses it yet.
- Auth middleware verifies Supabase access tokens through Supabase Auth using the anon key. Service role is not used for `/v1/me`.
- API routes are versioned under `/v1` to reduce EAS Updates compatibility risk.
- Creator application approval currently updates only `creator_applications.status` and `rejection_reason`. TODO: once the schema is confirmed, move admin review writes into a DB transaction/RPC that also records `reviewed_by`, `reviewed_at`, and updates creator/profile status.
