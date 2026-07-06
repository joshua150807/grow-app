import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { betaAccessCodes } from '../src/db/schema/betaAccessCodes.js';
import { profiles } from '../src/db/schema/profiles.js';
import {
  createBetaRegistrationCompletionRepository,
} from '../src/modules/betaRegistration/betaRegistrationRepository.js';

const expectedDatabaseName = 'grow_api_integration_test';
const allowedHosts = new Set(['localhost', '127.0.0.1']);

function getGuardedTestDatabaseUrl() {
  const connectionString = process.env.TEST_DATABASE_URL;

  if (!connectionString) {
    throw new Error('TEST_DATABASE_URL is required for beta registration integration tests.');
  }

  if (process.env.DATABASE_URL && process.env.DATABASE_URL === connectionString) {
    throw new Error('TEST_DATABASE_URL must not be identical to DATABASE_URL.');
  }

  if (process.env.ALLOW_INTEGRATION_DB_RESET !== 'true') {
    throw new Error(
      'ALLOW_INTEGRATION_DB_RESET=true is required for beta registration integration tests.',
    );
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(connectionString);
  } catch {
    throw new Error('TEST_DATABASE_URL must be a valid PostgreSQL connection URL.');
  }

  if (!['postgres:', 'postgresql:'].includes(parsedUrl.protocol)) {
    throw new Error('TEST_DATABASE_URL protocol must be postgres: or postgresql:.');
  }

  if (!allowedHosts.has(parsedUrl.hostname)) {
    throw new Error('TEST_DATABASE_URL host must be localhost or 127.0.0.1.');
  }

  const databaseName = decodeURIComponent(parsedUrl.pathname.replace(/^\//, ''));

  if (databaseName !== expectedDatabaseName) {
    throw new Error(`TEST_DATABASE_URL database must be ${expectedDatabaseName}.`);
  }

  return connectionString;
}

describe('Beta registration completion repository integration', () => {
  let pool: Pool;
  let repository: ReturnType<typeof createBetaRegistrationCompletionRepository>;

  beforeAll(async () => {
    const connectionString = getGuardedTestDatabaseUrl();
    pool = new Pool({ connectionString });
    const db = drizzle(pool, { schema: { profiles, betaAccessCodes } });
    repository = createBetaRegistrationCompletionRepository(db);

    await pool.query('CREATE SCHEMA IF NOT EXISTS auth');
    await pool.query('DROP TABLE IF EXISTS public.profiles');
    await pool.query('DROP TABLE IF EXISTS public.beta_access_codes');
    await pool.query('DROP TABLE IF EXISTS auth.users');
    await pool.query(`
      CREATE TABLE auth.users (
        id uuid PRIMARY KEY
      )
    `);
    await pool.query(`
      CREATE TABLE public.profiles (
        id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
        username text NOT NULL UNIQUE,
        grow_points integer DEFAULT 0,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now(),
        role text DEFAULT 'user',
        recovery_email text
      )
    `);
    await pool.query('CREATE UNIQUE INDEX profiles_lower_username_idx ON public.profiles (lower(username))');
    await pool.query('CREATE UNIQUE INDEX profiles_lower_recovery_email_idx ON public.profiles (lower(recovery_email))');
    await pool.query(`
      CREATE TABLE public.beta_access_codes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        code text NOT NULL UNIQUE,
        used_by uuid REFERENCES auth.users(id),
        used_at timestamptz,
        created_at timestamptz DEFAULT now()
      )
    `);
    await pool.query('CREATE UNIQUE INDEX beta_access_codes_upper_code_idx ON public.beta_access_codes (upper(code))');
  });

  beforeEach(async () => {
    await pool.query('DELETE FROM public.profiles');
    await pool.query('DELETE FROM public.beta_access_codes');
    await pool.query('DELETE FROM auth.users');
  });

  afterAll(async () => {
    if (!pool) return;

    try {
      await pool.query('DROP TABLE IF EXISTS public.profiles');
      await pool.query('DROP TABLE IF EXISTS public.beta_access_codes');
      await pool.query('DROP TABLE IF EXISTS auth.users');
    } finally {
      await pool.end();
    }
  });

  async function createUser(id = randomUUID()) {
    await pool.query('INSERT INTO auth.users (id) VALUES ($1)', [id]);
    return id;
  }

  async function createCode(code: string, usedBy: string | null = null, usedAt: string | null = null) {
    await pool.query(
      'INSERT INTO public.beta_access_codes (code, used_by, used_at) VALUES ($1, $2, $3)',
      [code, usedBy, usedAt],
    );
  }

  async function getCode(code: string) {
    const result = await pool.query(
      'SELECT code, used_by, used_at FROM public.beta_access_codes WHERE upper(code) = upper($1)',
      [code],
    );

    return result.rows[0] ?? null;
  }

  async function getProfile(userId: string) {
    const result = await pool.query(
      'SELECT id, username, grow_points, role, recovery_email FROM public.profiles WHERE id = $1',
      [userId],
    );

    return result.rows[0] ?? null;
  }

  it('atomically creates a profile and consumes a fresh code', async () => {
    const userId = await createUser();
    await createCode('fresh-code');

    const profile = await repository.complete({
      userId,
      code: 'FRESH-CODE',
      username: 'grower',
      recoveryEmail: 'grower@example.com',
    });

    expect(profile).toMatchObject({
      id: userId,
      username: 'grower',
      grow_points: 0,
      role: 'user',
    });
    expect(typeof profile.created_at).toBe('string');
    expect(typeof profile.updated_at).toBe('string');
    expect(profile).not.toHaveProperty('recovery_email');
    await expect(getProfile(userId)).resolves.toMatchObject({
      username: 'grower',
      grow_points: 0,
      role: 'user',
      recovery_email: 'grower@example.com',
    });
    await expect(getCode('fresh-code')).resolves.toMatchObject({
      used_by: userId,
      used_at: expect.any(Date),
    });
  });

  it('atomically completes an exact legacy fallback profile', async () => {
    const userId = await createUser();
    await createCode('legacy-code');
    await pool.query(
      `
        INSERT INTO public.profiles (id, username, grow_points, role, recovery_email)
        VALUES ($1, $2, 0, 'user', NULL)
      `,
      [userId, `user_${userId.slice(0, 6)}`],
    );

    const profile = await repository.complete({
      userId,
      code: 'LEGACY-CODE',
      username: 'finished',
      recoveryEmail: 'finished@example.com',
    });

    expect(profile.username).toBe('finished');
    expect(typeof profile.created_at).toBe('string');
    expect(typeof profile.updated_at).toBe('string');
    await expect(getProfile(userId)).resolves.toMatchObject({
      username: 'finished',
      recovery_email: 'finished@example.com',
    });
    await expect(getCode('legacy-code')).resolves.toMatchObject({
      used_by: userId,
      used_at: expect.any(Date),
    });
  });

  it('does not overwrite an existing real profile and rolls back the code', async () => {
    const userId = await createUser();
    await createCode('real-profile-code');
    await pool.query(
      `
        INSERT INTO public.profiles (id, username, grow_points, role, recovery_email)
        VALUES ($1, 'real_profile', 12, 'user', 'real@example.com')
      `,
      [userId],
    );

    await expect(repository.complete({
      userId,
      code: 'REAL-PROFILE-CODE',
      username: 'newname',
      recoveryEmail: 'new@example.com',
    })).rejects.toMatchObject({
      code: 'PROFILE_STATE_CONFLICT',
    });
    await expect(getProfile(userId)).resolves.toMatchObject({
      username: 'real_profile',
      grow_points: 12,
      recovery_email: 'real@example.com',
    });
    await expect(getCode('real-profile-code')).resolves.toMatchObject({
      used_by: null,
      used_at: null,
    });
  });

  it('returns idempotent success for a code already completed by the same user', async () => {
    const userId = await createUser();
    await createCode('done-code', userId, '2026-07-06T10:00:00.000Z');
    await pool.query(
      `
        INSERT INTO public.profiles (id, username, grow_points, role, recovery_email)
        VALUES ($1, 'done_user', 0, 'user', 'done@example.com')
      `,
      [userId],
    );

    const profile = await repository.complete({
      userId,
      code: 'DONE-CODE',
      username: 'ignored',
      recoveryEmail: 'done@example.com',
    });

    expect(profile.username).toBe('done_user');
  });

  it('rejects a code used by another user without changing state', async () => {
    const userId = await createUser();
    const otherUserId = await createUser();
    await createCode('other-code', otherUserId, '2026-07-06T10:00:00.000Z');

    await expect(repository.complete({
      userId,
      code: 'OTHER-CODE',
      username: 'grower',
      recoveryEmail: 'grower@example.com',
    })).rejects.toMatchObject({
      code: 'CODE_INVALID',
    });
    await expect(getProfile(userId)).resolves.toBeNull();
  });

  it('rejects inconsistent code state', async () => {
    const userId = await createUser();
    await createCode('inconsistent-code', userId, null);

    await expect(repository.complete({
      userId,
      code: 'INCONSISTENT-CODE',
      username: 'grower',
      recoveryEmail: 'grower@example.com',
    })).rejects.toMatchObject({
      code: 'REGISTRATION_STATE_CONFLICT',
    });
  });

  it('rejects a code used by the same user when the profile is missing', async () => {
    const userId = await createUser();
    await createCode('missing-profile-code', userId, '2026-07-06T10:00:00.000Z');
    const codeBefore = await getCode('missing-profile-code');

    await expect(repository.complete({
      userId,
      code: 'MISSING-PROFILE-CODE',
      username: 'grower',
      recoveryEmail: 'grower@example.com',
    })).rejects.toMatchObject({
      code: 'REGISTRATION_STATE_CONFLICT',
    });
    await expect(getProfile(userId)).resolves.toBeNull();

    const codeAfter = await getCode('missing-profile-code');
    expect(codeAfter.used_by).toBe(userId);
    expect(codeAfter.used_at.getTime()).toBe(codeBefore.used_at.getTime());
  });

  it('rejects inconsistent code state with used_at but no used_by', async () => {
    const userId = await createUser();
    await createCode('used-at-only-code', null, '2026-07-06T10:00:00.000Z');
    const codeBefore = await getCode('used-at-only-code');

    await expect(repository.complete({
      userId,
      code: 'USED-AT-ONLY-CODE',
      username: 'grower',
      recoveryEmail: 'grower@example.com',
    })).rejects.toMatchObject({
      code: 'REGISTRATION_STATE_CONFLICT',
    });
    await expect(getProfile(userId)).resolves.toBeNull();

    const codeAfter = await getCode('used-at-only-code');
    expect(codeAfter.used_by).toBeNull();
    expect(codeAfter.used_at.getTime()).toBe(codeBefore.used_at.getTime());
  });

  it('rejects a username owned by another profile and leaves code unused', async () => {
    const userId = await createUser();
    const otherUserId = await createUser();
    await createCode('username-code');
    await pool.query(
      `
        INSERT INTO public.profiles (id, username, grow_points, role, recovery_email)
        VALUES ($1, 'taken_name', 0, 'user', 'other@example.com')
      `,
      [otherUserId],
    );

    await expect(repository.complete({
      userId,
      code: 'USERNAME-CODE',
      username: 'TAKEN_NAME',
      recoveryEmail: 'grower@example.com',
    })).rejects.toMatchObject({
      code: 'USERNAME_TAKEN',
    });
    await expect(getCode('username-code')).resolves.toMatchObject({
      used_by: null,
      used_at: null,
    });
  });

  it('rejects a recovery email owned by another profile and leaves code unused', async () => {
    const userId = await createUser();
    const otherUserId = await createUser();
    await createCode('email-code');
    await pool.query(
      `
        INSERT INTO public.profiles (id, username, grow_points, role, recovery_email)
        VALUES ($1, 'other_user', 0, 'user', 'taken@example.com')
      `,
      [otherUserId],
    );

    await expect(repository.complete({
      userId,
      code: 'EMAIL-CODE',
      username: 'grower',
      recoveryEmail: 'TAKEN@example.com'.toLowerCase(),
    })).rejects.toMatchObject({
      code: 'EMAIL_TAKEN',
    });
    await expect(getCode('email-code')).resolves.toMatchObject({
      used_by: null,
      used_at: null,
    });
  });

  it('rejects partially matching legacy fallback profiles', async () => {
    const userId = await createUser();
    await createCode('partial-code');
    await pool.query(
      `
        INSERT INTO public.profiles (id, username, grow_points, role, recovery_email)
        VALUES ($1, $2, 1, 'user', NULL)
      `,
      [userId, `user_${userId.slice(0, 6)}`],
    );

    await expect(repository.complete({
      userId,
      code: 'PARTIAL-CODE',
      username: 'grower',
      recoveryEmail: 'grower@example.com',
    })).rejects.toMatchObject({
      code: 'PROFILE_STATE_CONFLICT',
    });
  });
});
