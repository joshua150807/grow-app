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
