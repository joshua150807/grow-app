# Internal Training V2 release — prepared 2026-11-27

Source: `release/training-v2-beta`, `cf3a593`. Local changes are uncommitted.

## Current gate: BLOCKED before production changes

The existing project is `wuilllpzdnnalavqkopx`; existing accounts and Auth remain the target.
Actual read-only catalog verification found **no V2 tables**, but the migration journal already contains
`20260728210635` (template provenance) and `20260730120000` (Grow template library).
Those entries reference absent V2 objects. Do not run an ordinary `supabase db push`, skip these
versions, or repair the journal without a separately reviewed and approved reconciliation.

The planner migration `20260802120000` is absent from the journal, while its date column,
constraint and both indexes match. It must not be reapplied on this database.

Backup metadata lists zero backup records and PITR disabled. No complete backup/restore test has
been demonstrated. A full backup, verified restore into an isolated target and a current write-aware
recovery procedure are mandatory before any production DDL or journal repair. The Training-only
rehearsal is not a backup of the application or of Auth/Storage.

## Implemented compatibility

The V2 hub explicitly links to **Bisheriger Trainingsplan & Verlauf**, including while V2 is loading.
The route reuses the existing V1 screen, services, owner filters, Auth, local drafts and session saves.
It does not copy, modify or import legacy rows. This remains safe when the user returns to Build 42
or continues editing V1. Read-only aggregation confirmed one existing plan per owner (12 owners).

Existing V1 sessions do **not** become V2 records/progress data. V1 has aggregate `sets/reps/weight`,
but no load type, completed individual sets or measured strength duration. Expanding aggregates
into completed V2 sets or choosing weight semantics would fabricate historical information.
A true editable V2 conversion requires a separately specified mapping, stable source identities,
handling continued V1 writes, and a replay-safe import contract. No such import is claimed here.

## Migration evidence and application boundary

`scripts/release/training-v2-migrations.json` fixes all 14 original filenames and SHA-256 hashes.
`node scripts/release/check-training-v2-migrations.cjs` verifies them without connecting to any DB.
`training-v2-production-preflight.sql` is read-only and reports schema/journal drift.

All 14 original SQL files ran successfully in order against a separate cached PostgreSQL 17 image,
with no network, exposed ports or host mounts. The five V1 table definitions, defaults, constraints,
indexes, trigger functions, policies, ACLs and real rows were copied through read-only queries.
Only Auth UUID references were stubbed; no passwords, emails or real Auth sessions were copied.
Results: 12 plans, 31 days, 212 exercises, 52 sessions and 441 session-exercise rows unchanged;
source/copy JSONB equality, before/after content equality, 24 owner RLS checks, 19 backend-only V2
tables. Other Grow schemas and full Supabase Auth were not restored or integration-tested.

After backup and explicit production approval, reconcile only the proven orphan journal entries,
then apply the reviewed 14-file set in dependency order, recording each successful migration.
Do not change original migration files or run reset/seed. `20260726210000` contains its own
BEGIN/COMMIT: an outer single transaction around the raw file list is not a valid atomic rollback
strategy. Use a reviewed transaction-aware migration runner; abort on first error, with short lock
timeouts. Verify catalog definitions, grants, constraints and journal before resuming after failure.
New indexes affect only new V2 tables on this baseline. Never drop V2 tables to roll back a client
after real training data has been saved. Restoring all of Production can discard concurrent Build 42
writes: recovery must account for those writes and cannot be an automatic restore command.

## Compatible login preparation

The additive `/v1/auth/username-login` endpoint is off by default. Enable it only on the reviewed
new API using `USERNAME_LOGIN_V1_ENABLED=true`. It resolves the existing username mapping on the
backend, verifies the password with a fresh Supabase client per request and returns only tokens.
Generic credential/provider errors, no-store responses, body limits, HTTPS on Mobile, no automatic
retry/fallback, and per-peer/per-normalized-username limits are included. Secrets are redacted.

Limiter state is bounded and local to one process. Deploy one instance initially; a verified shared
edge limit is required before adding replicas. Forwarded IP headers are not trusted. Railway proxy
peers may share the conservative per-peer allowance; verify real deployment behaviour.

The new internal profile opts into API login with `EXPO_PUBLIC_USERNAME_LOGIN_API_ENABLED=true`.
All other profiles retain the existing login path. The legacy public email-resolution RPC remains
callable for Build 42: **the existing public email exposure is not globally fixed**. Removing that
permission now would break older username logins. Retire it only after an explicitly approved
old-build transition. No Auth permission changes were applied.

## API rollout, after approval

Prefer a parallel `grow-api-training-v2-internal` service using the same production DB/Auth.
No Railway CLI/API credential was available in this session; account plan and incremental cost
could not be verified. Do not create the service or trigger a deployment without explicit approval.
No deployment files point automatically to Production.

Build from the reviewed release commit: `npm ci`, `npm run build:shared`, `npm run build:api`,
then `npm --workspace @grow/api start` (ordinary `node dist/src/server.js`, no tsx loader).
Use server-only DATABASE_URL and existing Supabase server keys from approved secret storage.
No startup migration, seed, user creation or production smoke-test write is permitted.

Use the same Supabase URL as the mobile build. Set `USERNAME_LOGIN_V1_ENABLED=true`,
`NODE_ENV=production`, `HOST=0.0.0.0`, platform PORT and reviewed LOG_LEVEL.
Keep the old API unchanged. Rollback is to stop distributing the new client or revert only the new
parallel service to its previously verified artifact; retain database extensions and saved sessions.
If an in-place rollout is necessary, first verify old-build routes against the new artifact and preserve
the previous deployment artifact/configuration for rollback. This has not been deployed or tested online.

Before building, run public probes using the actual new API URL:

```powershell
$env:EXPO_PUBLIC_API_URL = 'https://<verified-new-api-domain>'
$env:EXPO_PUBLIC_SUPABASE_URL = 'https://wuilllpzdnnalavqkopx.supabase.co'
node scripts/release/check-internal-targets.cjs
```

These probes establish route/auth boundaries only. After explicit account authorization, test login,
V1 reads, V2 plans/save/history/records/progress and other Grow tools with those existing accounts.
Do not create test accounts or write into another user's data. Production account E2E is still pending.

## Existing iOS app, isolated internal build

`training-v2-internal` extends the existing store beta profile and production EAS environment.
It keeps EAS `@dev_grow/Grow`, project `8c1e8833-6b65-4b94-9720-956f8564da1d`, bundle
`app.joingrow.grow` and auto-increment. It enables V2, uses channel `training-v2-internal` and
app version `1.0.9`, so its runtime (policy `appVersion`) is `1.0.9`. Build 42 keeps version and
runtime `1.0.8` on channel `beta`. A dynamic `app.config.js` was removed because EAS calculated a
different runtime locally and on the build server.
The existing beta channel has not been updated, remapped or published to.

The production EAS environment currently points to the old API, whose V2 routes are not ready.
Once a parallel API is verified, add **only to this profile** its API URL override. Do not globally
change production EAS variables that the beta profile uses. Keep the original Supabase URL and
publishable key; no staging account/project is the final target.

App Store Connect group automation was not verifiable with available API credentials. Before
upload, an App Manager must check every external group for automatic new-build distribution and
disable/avoid assignment of this build, then select only the intended existing internal group.
EAS `distribution: store` does not enforce TestFlight group isolation. Do not use auto-submit.
No external group's build selection may change; Build 42 must remain selected there.

Only after DB, API, backup, authorized account E2E, iPhone, group-automation and commit/push
approvals are satisfied, the proposed build command is:

```powershell
Set-Location C:\Projects\Grow\Grow-App-Release-TrainingV2\apps\mobile
eas build --platform ios --profile training-v2-internal
```

This command is **not authorized yet**. Submission/group assignment requires its own approval.
No new app, bundle, EAS project, group or external TestFlight release was created.

## Verification performed

- New Mobile regression: four failures before implementation, four passes afterwards.
- Targeted Mobile suite: 54 passed, 0 failed.
- Targeted API Auth/registration/new-login suite: 25 passed, 0 failed.
- Shared and API rebuilt; all three workspace typechecks passed.
- Actual ordinary Node server: health 200, five protected routes 401, login validation 400.
  Only loopback, disabled DB address and no production credentials; own process terminated.
- Effective Expo config confirms existing bundle/project and isolated internal runtime.
- No authenticated production requests, real account login, production writes or iPhone acceptance.

Remaining release gates are explicit; successful local tests do not authorize migration or release.
