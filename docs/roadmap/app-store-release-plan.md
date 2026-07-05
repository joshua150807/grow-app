# App Store Release Roadmap

This roadmap is a living planning document for the Grow App Store release. It is not the technical source of truth. Existing code, verified schemas, tests, runtime behavior, and migrations remain authoritative.

## Current Milestone

Status: ✅ Done
Backend: Monorepo, Fastify API, Drizzle, `pg` pool, and the first Profile read vertical slice are in place.
Tests: Mapper tests, repository unit tests, service tests, runtime composition tests, and an isolated PostgreSQL integration test exist.
Integration: `GET /v1/profile/me` reads through Drizzle/PostgreSQL in runtime; `PATCH /v1/profile/me` remains on Supabase.
Runtime: Supabase Auth remains the auth source, `DATABASE_URL` is lazy, and DB lifecycle/graceful shutdown are wired.
Beta Migration: No extra beta migration is required only for this internal architecture step.
Docs: API README documents the Drizzle runtime read path and integration test.
Commit: Completed through the Profile Drizzle runtime and documentation commits.

Completed facts:

- Monorepo exists.
- Fastify API exists.
- Drizzle is integrated.
- `pg` pool exists.
- First complete Profile vertical slice is complete.
- Real `profiles` schema was verified.
- Persistence/OR mapper exists.
- Domain model exists.
- API DTO mapper exists.
- Repository contract exists.
- Drizzle repository exists.
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

This does not mean the full backend is finished.

## Controlled Beta Migration Strategy

Do not migrate the active beta after every small technical change. Migrate beta users only after a larger, coherent, safe slice is complete.

Standard Beta Gate:

1. Slice is functionally complete.
2. Unit tests are green.
3. Typecheck is green.
4. Build is green.
5. Real integration test exists and is green where DB behavior matters.
6. Regression/security audit is complete.
7. DB changes are additive and backward-compatible.
8. Backend can be deployed first.
9. Existing mobile beta remains compatible.
10. New mobile beta switches over in a controlled way.
11. Smoke test is complete.
12. Testers are observed after rollout.
13. Rollback path exists.
14. Old path is removed only later.

Rules:

- No big bang migration.
- Never blindly switch beta to new backend or Drizzle paths.
- Move larger stable slices into beta early enough to learn.
- Do not stockpile every migration until just before release.

## Architecture Rules

- Supabase remains responsible for Auth, PostgreSQL, RLS, policies, and selected RPCs.
- Drizzle is the backend query layer.
- Fastify is the API, security, and business-logic boundary.
- Avoid big-bang rewrites.
- `supabase/migrations` remains the leading migration source for now.
- Drizzle Kit must not take schema ownership yet.
- Service Role must never exist in the mobile client.
- Do not blindly replace `review_creator_application`.
- Protect the active beta.
- Build new paths in parallel, then switch over in controlled beta migrations.

## Phase 0 - Current Architecture Milestone

Status: ✅ Done
Backend: Profile read vertical slice complete; no additional beta switch needed only because internals changed.
Tests: ✅ Done
Integration: ✅ Done
Runtime: ✅ Done
Beta Migration: N/A
Docs: ✅ Done
Commit: ✅ Done

## Phase 1 - Creator Reads

Status: ⬜ Not Started
Backend: Verify live schema read-only; audit existing routes, runtime, repositories, contracts, auth, ownership, and tests; then add only the Drizzle/read-layer components justified by the audit.
Tests: Add unit tests for mappers, repositories, and services.
Integration: Add real PostgreSQL integration tests.
Runtime: Wire creator read paths after audit.
Beta Migration: Controlled beta migration of Creator reads after gate.
Docs: Update API docs.
Commit: Pending

## Phase 2 - Creator Writes

Status: ⬜ Not Started
Backend: Application create, ownership, validation, duplicate/open conflict handling, and idempotency. Keep `review_creator_application` RPC intentionally.
Tests: Unit tests for validation, conflicts, ownership, and service behavior.
Integration: Real DB integration tests for write paths.
Runtime: Wire write paths carefully.
Beta Migration: Controlled beta migration of Creator Application flow after gate.
Docs: Update creator write docs.
Commit: Pending

## Phase 3 - Public Profile / Account System

Status: ⬜ Not Started
Backend: Final product model for username, optional display name, avatar, bio, creator badge, rank, privacy, and visibility.
Tests: Backend and mobile contract tests where useful.
Integration: Additive migration and DB integration tests.
Runtime: Backend and mobile support through expand-and-contract.
Beta Migration: Expand-and-contract beta migration.
Docs: Product and API contract docs.
Commit: Pending

## Phase 4 - Creator Video Upload Pipeline

Status: ⬜ Not Started
Backend: Auth, creator permission, R2 upload, object keys, MIME/size validation, metadata, upload status, processing status, review status, cleanup, thumbnails, publish/unpublish.
Tests: Unit and integration tests for permission, metadata, and lifecycle states.
Integration: Storage and DB integration checks.
Runtime: Backend upload pipeline.
Beta Migration: Start with a small creator group.
Docs: Upload flow and operations docs.
Commit: Pending

## Phase 5 - AI Upload Evaluation

Status: ⬜ Not Started
Backend: AI jobs, scoring, flags, reasons, prompt versioning, provider layer, retry, timeout, cost limits, manual review, audit trail.
Tests: Unit tests for job state, provider behavior, and evaluation decisions.
Integration: Provider and queue integration where appropriate.
Runtime: Internal-only first.
Beta Migration: Controlled beta impact after internal validation.
Docs: Prompt/version and review docs.
Commit: Pending

## Phase 6 - Feed Backend

Status: ⬜ Not Started
Backend: Reads, pagination, cursor, ordering, publish status, moderation, ownership, views, ratings, aggregates, performance.
Tests: Unit tests for ordering, pagination, permissions, and aggregates.
Integration: DB integration tests for feed queries.
Runtime: Move feed paths slice by slice.
Beta Migration: Reads, ratings, views, and ordering in separate steps.
Docs: Feed API docs.
Commit: Pending

## Phase 7 - Grow Points / Ranking

Status: ⬜ Not Started
Backend: Point event ledger, source, idempotency, aggregation, ranking, anti-abuse.
Tests: Unit tests for idempotency and aggregation.
Integration: Ledger and ranking integration tests.
Runtime: Start in shadow/parallel mode.
Beta Migration: Switch beta after shadow comparison.
Docs: Points and anti-abuse docs.
Commit: Pending

## Phase 8 - KI Mentor

Status: ⬜ Not Started
Backend: V1 scope freeze, conversations, messages, context builder, provider layer, prompt versioning, streaming, rate limits, quotas, cost limits, safety, feedback, evaluation, privacy, admin diagnostics.
Tests: Unit tests for context, safety, provider boundaries, and quotas.
Integration: Provider integration and streaming tests where safe.
Runtime: Internal first.
Beta Migration: Internal -> small group -> larger group.
Docs: Mentor V1 scope and provider docs.
Commit: Pending

## Phase 9 - Community Foundation

Status: ⬜ Not Started
Backend: Product decision, identity, blocks, reports, moderation queue, content status, bans/suspensions, audit logs, guidelines, support contact.
Tests: Unit tests for moderation and permissions.
Integration: DB integration tests for reports and moderation state.
Runtime: Closed beta first.
Beta Migration: Closed beta only at first.
Docs: Community rules and moderation docs.
Commit: Pending

## Phase 10 - Challenges

Status: ⬜ Not Started
Backend: Challenge model, join/leave, participants, progress, completion, ranking, rewards, rules, abuse protection.
Tests: Unit tests for rules, participation, and completion.
Integration: DB integration tests for progress and ranking.
Runtime: Small beta first.
Beta Migration: Controlled small beta.
Docs: Challenge model docs.
Commit: Pending

## Phase 11 - Chats

Status: ⬜ Not Started
Backend: Scope decision, conversations, members, messages, read states, pagination, realtime, blocks, reports, deletes, rate limits, spam protection.
Tests: Unit tests for membership, permissions, rate limits, and deletes.
Integration: Realtime and DB integration tests.
Runtime: Internal tests first.
Beta Migration: Internal -> small beta -> larger beta.
Docs: Chat scope and safety docs.
Commit: Pending

## Phase 12 - Tools / Sync Migration

Status: ⬜ Not Started
Backend: Journal, habits, todo, training, affirmations, analytics, deep work, and further tools reviewed one by one. Decide per tool: local, direct Supabase, backend API, or hybrid.
Tests: Per-tool tests only after a migration decision.
Integration: Per-tool integration tests where backend or DB is involved.
Runtime: Migrate tools individually.
Beta Migration: One tool at a time.
Docs: Tool migration decisions.
Commit: Pending

## Phase 13 - Admin / Analytics / Moderation Operations

Status: ⬜ Not Started
Backend: Creator review, video moderation, reports, user actions, bans, feedback, AI evaluation, audit logs, product analytics.
Tests: Unit tests for permissions, actions, and audit behavior.
Integration: DB integration tests for moderation operations.
Runtime: Internal users first.
Beta Migration: Internal operational rollout.
Docs: Admin operations docs.
Commit: Pending

## Phase 14 - Full Backend Coverage Audit

Status: ⬜ Not Started
Backend: Inventory every direct mobile Supabase call and decide: keep, migrate, keep RPC, or remove. Review rate limits, security, DB indexes, query performance, N+1, pooling, secrets, logging, monitoring, alerts, backup, restore, and CI.
Tests: Fill meaningful gaps only.
Integration: Confirm critical DB paths.
Runtime: No broad switch without gate.
Beta Migration: Per decision.
Docs: Coverage audit report.
Commit: Pending

## Phase 15 - Production Backend Deployment

Status: ⬜ Not Started
Backend: Hosting decision, staging, production, secrets, `DATABASE_URL`, healthchecks, deploy, rollback, logs, monitoring. Backend deploys first and remains backward-compatible.
Tests: Deployment smoke tests.
Integration: Staging integration checks.
Runtime: Production backend ready before mobile switch.
Beta Migration: Beta migrates after backend is stable.
Docs: Deployment and rollback docs.
Commit: Pending

## Phase 16 - Controlled Mobile Migration

Status: ⬜ Not Started
Backend: Profile, Creator, Upload, Feed, Ratings, Points, KI Mentor, Community, Challenges, Chats, and Tools exposed through controlled backend-backed paths.
Tests: Mobile and backend regression after each large slice.
Integration: Slice-specific integration checks.
Runtime: Mobile switches gradually.
Beta Migration: Run the beta gate after every large slice.
Docs: Migration log.
Commit: Pending

## Phase 17 - Feature Freeze / Release Beta

Status: ⬜ Not Started
Backend: No major features; bugs, performance, security, device matrix, crash analysis, fresh install, upgrade, auth, account delete, upload, feed, AI, community, chat.
Tests: Full regression suite.
Integration: Release beta smoke and integration checks.
Runtime: Stabilization only.
Beta Migration: Release beta.
Docs: Release beta checklist.
Commit: Pending

## Phase 18 - App Store Compliance

Status: ⬜ Not Started
Backend: Account deletion, privacy policy support, app privacy, support URL, moderation, reporting, blocking, UGC safety, demo account, review notes, age rating, SDK privacy audit, metadata, screenshots.
Tests: Compliance smoke tests.
Integration: Account deletion and moderation checks.
Runtime: Compliance-ready.
Beta Migration: N/A
Docs: App Store compliance docs.
Commit: Pending

## Phase 19 - Release Candidate

Status: ⬜ Not Started
Backend: Final main state, release branch/tag, final iOS build, TestFlight RC, final smoke test, submission build.
Tests: Final release candidate regression.
Integration: Final production/staging sanity checks.
Runtime: RC freeze.
Beta Migration: TestFlight RC.
Docs: RC notes.
Commit: Pending

## Phase 20 - App Store Release

Status: ⬜ Not Started
Backend: App Store Connect, metadata, privacy, demo login, review notes, submit, review, fixes, release.
Tests: Final smoke after approval.
Integration: Production monitoring during release.
Runtime: Release operations.
Beta Migration: Public release.
Docs: Release log.
Commit: Pending
