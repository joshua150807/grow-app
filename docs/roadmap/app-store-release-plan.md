# App Store Release Roadmap

This roadmap is a living planning document for the Grow App Store release. It is not the technical source of truth. Existing code, verified schemas, tests, runtime behavior, and migrations remain authoritative.

## Strategy

Grow should reach the first public App Store release through vertical product slices, not through a long backend-only buildout followed by one large mobile migration.

Each large product slice should move in this order where relevant:

1. Product scope and user-facing behavior.
2. Schema / persistence.
3. Backend API, services, repositories, validation, and error handling.
4. Auth, ownership, RLS, policies, and security review.
5. Mobile UI.
6. Mobile/API integration.
7. Loading, error, and empty states.
8. Unit tests, integration tests, and real DB integration tests where DB paths matter.
9. Additive and backward-compatible migration.
10. Beta Migration Gate.
11. Controlled beta rollout.
12. Observation.
13. Rollback path.
14. Next product slice.

Not every item must be forced into every slice. If a point is not relevant for a slice, the deviation must be explicit and intentional.

## Current Milestone

Status: ✅ Partly Done
Backend: Monorepo, Fastify API, Drizzle, `pg` pool, and the first Profile read vertical slice are in place.
Tests: Profile mapper tests, repository unit tests, service tests, runtime composition tests, and an isolated PostgreSQL integration test exist.
Integration: `GET /v1/profile/me` reads through Drizzle/PostgreSQL in runtime; `PATCH /v1/profile/me` remains on Supabase.
Runtime: Supabase Auth remains the auth source, `DATABASE_URL` is lazy, and DB lifecycle/graceful shutdown are wired.
Beta Migration: No controlled beta rollout has happened for a full product slice yet. The current Profile backend work was an internal architecture step.
Docs: API README documents the Drizzle runtime read path and integration test.
Commit: Completed through the Profile Drizzle runtime and documentation commits.

Completed facts:

- Monorepo exists.
- Fastify API exists.
- Drizzle is integrated.
- `pg` pool exists.
- First Profile backend read slice exists.
- Real `profiles` schema was verified.
- Persistence/OR mapper exists for Profile reads.
- Domain model exists for Profile reads.
- API DTO mapper exists for Profile reads.
- Repository contract exists for Profile reads.
- Drizzle repository exists for Profile reads.
- `ProfileReadService` exists.
- Mapper tests exist.
- Repository unit tests exist.
- Service tests exist.
- Real isolated PostgreSQL integration test exists.
- Runtime wiring for `GET /v1/profile/me` uses Drizzle/PostgreSQL.
- `PATCH /v1/profile/me` stays on Supabase.
- Supabase Auth remains in place.
- DB lifecycle and graceful shutdown exist.
- Docker Desktop/WSL2 local test DB works.
- Active beta remains protected.

This does not mean the full Profile product slice, Creator system, or backend are finished.

## Completion Rule

A large product slice is complete only when the relevant work is complete across product, backend, security, mobile, testing, and rollout:

- Schema / persistence.
- Backend.
- Auth / ownership / security.
- Mobile UI.
- Mobile/API integration.
- Loading states.
- Error states.
- Empty states.
- Unit tests.
- Integration tests.
- Real DB integration where DB paths matter.
- Additive/backward-compatible migration.
- Beta Migration Gate.
- Smoke test.
- Controlled rollout.
- Observation phase.
- Rollback path.

If a slice does not need one of these items, the reason should be documented in that slice.

## Controlled Beta Migration Strategy

Do not migrate the active beta after every small technical change. Migrate beta users only after a larger, coherent, safe product slice is ready.

Standard Beta Gate:

1. Product slice is functionally complete.
2. Unit tests are green.
3. Typecheck is green.
4. Build is green.
5. Real integration test exists and is green where DB behavior matters.
6. Regression/security audit is complete.
7. DB changes are additive and backward-compatible.
8. Backend can be deployed first.
9. Existing mobile beta remains compatible.
10. New mobile path switches over in a controlled way.
11. Smoke test is complete.
12. Testers are observed after rollout.
13. Rollback path exists.
14. Old path is removed only later.

Rules:

- No big bang migration.
- Never blindly switch beta to new backend or Drizzle paths.
- Large stable product slices should enter active beta early enough to learn from real usage.
- Do not stockpile every migration until the end of the release.
- Backend must be deployable first.
- Existing beta mobile builds must remain compatible during migration.
- New mobile paths must be activated deliberately and observed.

## Architecture Rules

- Supabase remains responsible for Auth, PostgreSQL, RLS, policies, and selected RPCs.
- Drizzle is the backend query layer for controlled backend-owned DB paths.
- Fastify is the API, security, and business-logic boundary.
- Avoid big-bang rewrites.
- `supabase/migrations` remains the leading migration source for now.
- Drizzle Kit must not take schema ownership yet.
- Service Role must never exist in the mobile client.
- Do not blindly replace `review_creator_application`; keep it intentionally until a later write-slice decision says otherwise.
- Protect the active beta.
- Build new paths in parallel, then switch over in controlled beta migrations.

## Product Slice 1 - Profile System

Status: 🟨 In Progress

Goal: Users have a reliable profile experience backed by the backend where production security and compatibility matter.

Completed backend foundation:

- Profile backend read path exists.
- `GET /v1/profile/me` reads through Drizzle/PostgreSQL and is a completed technical foundation.
- `PATCH /v1/profile/me` stays on the existing Supabase-backed path.
- Supabase Auth remains the auth source.
- Drizzle schema, mapper, domain model, read repository contract, Drizzle repository, read service, runtime composition, and tests exist for the read path.
- Real isolated PostgreSQL integration test exists.

Remaining product slice work:

- Finalize the Profile product model for the release scope before full UI rollout.
- Explicitly decide the required V1 scope for username, optional display name, avatar, bio, creator badge, rank, privacy, and visibility.
- Do not force every Profile field into V1; record deliberate exclusions and later-slice decisions.
- Complete any missing additive/backward-compatible schema, API, auth, ownership, and security work needed by the chosen release scope.
- Complete Profile UI for the release scope.
- Wire mobile Profile/API integration deliberately.
- Verify authenticated user ownership behavior end to end.
- Add loading, error, and empty states.
- Add or adjust mobile/backend contract tests where useful.
- Run typecheck, build, unit tests, and integration tests.
- Confirm additive/backward-compatible behavior for existing beta builds.
- Pass Beta Migration Gate.
- Roll out to beta in a controlled way.
- Observe testers.
- Keep a rollback path.

Docs: Keep API docs current for Profile read/write behavior.

## Product Slice 2 - Creator System

Status: 🟨 Analysis Started, Implementation Not Started

Goal: Users can apply to become creators, see their application status, and admins/CEOs can review applications through a secure backend boundary.

Analysis progress:

- Creator read-only analysis has been performed.
- Existing runtime, routes, repositories, auth/ownership checks, tests, and migration shape were reviewed.
- This analysis is not an implementation and does not complete the slice.

Backend and schema work:

- Verify live Creator schema read-only before Drizzle implementation.
- Keep `public.review_creator_application` as the review RPC for now.
- Do not replace the RPC blindly.
- Build a dedicated `/creator/applications/me` read slice first.
- Treat admin application reads separately from user `/me` reads.
- Preserve service-side admin/CEO authorization for admin operations.
- Keep Creator writes scoped separately: application create, ownership, validation, duplicate/open conflict handling, and idempotency.
- Keep review decision behavior atomic through the existing RPC until a later explicit decision.

Mobile/product work:

- Creator application UI.
- Application status UI.
- Admin review UI.
- Mobile/API integration for create, own-status read, admin list, and review decision.
- Loading, error, and empty states for user and admin surfaces.

Tests and rollout:

- Mapper, repository, service, route, and runtime tests where the slice adds new components.
- Real PostgreSQL integration tests for Creator read paths.
- Tests for ownership, admin/CEO authorization, invalid filters, conflict handling, and RPC error mapping.
- Additive/backward-compatible migration only.
- Beta Migration Gate.
- Controlled beta rollout and observation.
- Rollback path.

Docs: Creator API contracts and operational notes.

## Product Slice 3 - Creator Upload Pipeline

Status: ⬜ Not Started

Goal: Approved creators can upload videos through a controlled backend and storage pipeline.

Scope:

- Backend auth and creator permission checks.
- Storage integration, object keys, MIME/size validation, metadata, upload status, processing status, review status, cleanup, thumbnails, publish/unpublish.
- Mobile upload UI.
- Mobile/API integration.
- Upload progress, loading, error, retry, and empty states.
- Storage and DB integration checks.
- Unit and integration tests for permission, metadata, lifecycle states, and cleanup.
- Start with a small creator group after Beta Migration Gate.
- Observe failures, upload latency, and moderation handoff.
- Rollback path for disabling upload without breaking existing builds.

Docs: Upload flow, storage rules, and operations docs.

## Product Slice 4 - AI Upload Evaluation

Status: ⬜ Not Started

Goal: Uploaded creator videos receive AI-assisted evaluation while manual review remains the release safety boundary.

Scope:

- AI jobs, scoring, flags, reasons, prompt versioning, provider layer, retry, timeout, cost limits, manual review, and audit trail.
- Relevant Creator/Admin UI for evaluation state and review reasons.
- Mobile/API integration where user-visible status is needed.
- Loading, error, and pending states for evaluation.
- Unit tests for job state, provider behavior, and evaluation decisions.
- Provider and queue integration where appropriate and safe.
- Internal-only validation before beta impact.
- Beta Migration Gate before exposing meaningful user-facing behavior.
- Observation and rollback path.

Docs: Prompt/version, evaluation, and review docs.

## Product Slice 5 - Feed Backend

Status: ⬜ Not Started

Goal: Feed behavior is stable, moderated, paginated, and performant through backend-owned paths.

Scope:

- Backend reads, pagination, cursor, ordering, publish status, moderation, ownership, views, ratings, aggregates, and performance.
- Mobile feed integration.
- Loading, error, empty, and refresh states.
- Regression and performance checks.
- Unit tests for ordering, pagination, permissions, and aggregates.
- DB integration tests for feed queries.
- Migrate reads, ratings, views, and ordering in controlled steps.
- Beta Migration Gate per stable feed step.
- Observation and rollback path.

Docs: Feed API and performance notes.

## Product Slice 6 - Grow Points / Ranking

Status: ⬜ Not Started

Goal: Points and ranking are backed by auditable, idempotent backend logic.

Scope:

- Point event ledger, source, idempotency, aggregation, ranking, and anti-abuse.
- Ranking and points UI.
- Mobile/API integration.
- Loading, error, and empty states.
- Unit tests for idempotency, aggregation, ranking, and anti-abuse rules.
- Ledger and ranking integration tests.
- Shadow/parallel mode before visible switch.
- Beta Migration Gate after shadow comparison.
- Observation and rollback path.

Docs: Points, ranking, and anti-abuse docs.

## Product Slice 7 - KI Mentor

Status: ⬜ Not Started

Goal: KI Mentor V1 is useful, bounded, safe, and observable for the public release.

Scope:

- V1 scope freeze, conversations, messages, context builder, provider layer, prompt versioning, streaming, rate limits, quotas, cost limits, safety, feedback, evaluation, privacy, and admin diagnostics.
- Mentor UI.
- Mobile/API integration.
- Loading, streaming, error, empty, quota, and safety states.
- Unit tests for context, safety, provider boundaries, and quotas.
- Provider integration and streaming tests where safe.
- Internal first, then small group, then larger group.
- Beta Migration Gate for each expansion.
- Observation and rollback path.

Docs: Mentor V1 scope, provider, safety, and operations docs.

## Additional Product Slices

These slices should also be handled vertically. They do not need to wait until the end if a coherent, safe part can pass the Beta Migration Gate.

### Community Foundation

Status: ⬜ Not Started
Scope: Product decision, identity, blocks, reports, moderation queue, content status, bans/suspensions, audit logs, guidelines, support contact, mobile UI, integration, moderation tests, DB integration tests, closed beta first, observation, rollback.

### Challenges

Status: ⬜ Not Started
Scope: Challenge model, join/leave, participants, progress, completion, ranking, rewards, rules, abuse protection, mobile UI, integration, rules tests, DB integration tests, controlled small beta, observation, rollback.

### Chats

Status: ⬜ Not Started
Scope: Scope decision, conversations, members, messages, read states, pagination, realtime, blocks, reports, deletes, rate limits, spam protection, mobile UI, integration, membership/permission/rate-limit tests, realtime and DB integration tests, internal tests first, small beta, observation, rollback.

### Tools / Sync

Status: ⬜ Not Started
Scope: Journal, habits, todo, training, affirmations, analytics, deep work, and further tools reviewed one by one. Decide per tool: local, direct Supabase, backend API, or hybrid. Migrate one tool at a time with UI, integration, states, tests, Beta Migration Gate, observation, and rollback where relevant.

### Admin / Analytics / Moderation

Status: ⬜ Not Started
Scope: Creator review, video moderation, reports, user actions, bans, feedback, AI evaluation, audit logs, product analytics, internal admin UI, permission tests, audit behavior tests, DB integration tests, internal operational rollout, observation, rollback.

## Global Phase 1 - Full Backend Coverage Audit

Status: ⬜ Not Started

Purpose: Confirm what still talks directly to Supabase and decide per area: keep, migrate, keep RPC, or remove.

Scope:

- Inventory every direct mobile Supabase call.
- Review rate limits, security, DB indexes, query performance, N+1, pooling, secrets, logging, monitoring, alerts, backup, restore, and CI.
- Fill meaningful test gaps only.
- Confirm critical DB paths with integration tests.
- No broad switch without a gate.
- Update coverage audit report.

## Global Phase 2 - Production Backend Deployment

Status: ⬜ Not Started

Purpose: Make the backend production-ready before mobile paths depend on it.

Scope:

- Hosting decision.
- Staging and production environments.
- Secrets and `DATABASE_URL`.
- Healthchecks.
- Deploy and rollback.
- Logs and monitoring.
- Deployment smoke tests.
- Staging integration checks.
- Backend deploys first and remains backward-compatible.

Docs: Deployment and rollback docs.

## Global Phase 3 - Remaining Controlled Mobile Migrations

Status: ⬜ Not Started

Purpose: Finish any mobile migrations not already completed inside product slices.

Scope:

- Profile, Creator, Upload, Feed, Ratings, Points, KI Mentor, Community, Challenges, Chats, and Tools exposed through controlled backend-backed paths where required.
- Mobile switches gradually.
- Run the Beta Migration Gate after every remaining large slice.
- Maintain a migration log.
- Remove old paths only after observation and explicit cleanup decisions.

## Global Phase 4 - Feature Freeze / Release Beta

Status: ⬜ Not Started

Purpose: Stop adding major features and stabilize the release candidate surface.

Scope:

- Bugs, performance, security, device matrix, crash analysis, fresh install, upgrade, auth, account delete, upload, feed, AI, community, and chat.
- Full regression suite.
- Release beta smoke and integration checks.
- Stabilization only.
- Release beta.
- Release beta checklist.

## Global Phase 5 - App Store Compliance

Status: ⬜ Not Started

Purpose: Ensure the app and backend satisfy App Store requirements.

Scope:

- Account deletion.
- Privacy policy support.
- App privacy.
- Support URL.
- Moderation, reporting, blocking, UGC safety.
- Demo account.
- Review notes.
- Age rating.
- SDK privacy audit.
- Metadata and screenshots.
- Compliance smoke tests.
- Account deletion and moderation checks.

Docs: App Store compliance docs.

## Global Phase 6 - Release Candidate

Status: ⬜ Not Started

Purpose: Freeze the final release candidate and prepare submission.

Scope:

- Final main state.
- Release branch/tag.
- Final iOS build.
- TestFlight RC.
- Final smoke test.
- Submission build.
- Final release candidate regression.
- Final production/staging sanity checks.
- RC notes.

## Global Phase 7 - App Store Release

Status: ⬜ Not Started

Purpose: Submit, monitor, and release the first public Grow version.

Scope:

- App Store Connect.
- Metadata.
- Privacy.
- Demo login.
- Review notes.
- Submit.
- Review fixes if needed.
- Release.
- Final smoke after approval.
- Production monitoring during release.
- Release log.
