# Grow Backend

Fastify backend skeleton for the Grow production release. This service is the future boundary for validation, authorization, business logic, logging, Supabase access, creator uploads, video moderation, and the KI Mentor.

## Setup

```bash
cd backend
npm install
cp .env.example .env
```

Fill `.env` with server-only values when a route actually needs them. The Supabase service role key must never be exposed to the mobile app.

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
- `GET /v1/me` is a placeholder. It reads the optional Bearer token shape but does not verify Supabase JWTs or load a profile yet.

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
  routes/
  validation/
tests/
```

## Notes

- Supabase Admin Client is prepared in `src/integrations/supabase/adminClient.ts`, but no production route uses it yet.
- Auth middleware is prepared in `src/middleware/auth.ts`. Real Supabase JWT verification is intentionally left for the next ticket.
- API routes are versioned under `/v1` to reduce EAS Updates compatibility risk.
