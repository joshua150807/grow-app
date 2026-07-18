import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { profiles } from '../src/db/schema/profiles.js';
import { DrizzleProfilesRepository } from '../src/modules/profiles/repositories/drizzleProfilesRepository.js';

const expectedDatabaseName = 'grow_api_integration_test';
const allowedHosts = new Set(['localhost', '127.0.0.1']);

function getGuardedTestDatabaseUrl() {
  const connectionString = process.env.TEST_DATABASE_URL;

  if (!connectionString) {
    throw new Error('TEST_DATABASE_URL is required for profile integration tests.');
  }

  if (process.env.DATABASE_URL && process.env.DATABASE_URL === connectionString) {
    throw new Error('TEST_DATABASE_URL must not be identical to DATABASE_URL.');
  }

  if (process.env.ALLOW_INTEGRATION_DB_RESET !== 'true') {
    throw new Error('ALLOW_INTEGRATION_DB_RESET=true is required for profile integration tests.');
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

describe('DrizzleProfilesRepository integration', () => {
  let pool: Pool;
  let repository: DrizzleProfilesRepository;

  beforeAll(async () => {
    const connectionString = getGuardedTestDatabaseUrl();
    pool = new Pool({ connectionString });
    const db = drizzle(pool, { schema: { profiles } });
    repository = new DrizzleProfilesRepository(db);

    await pool.query('DROP TABLE IF EXISTS public.profiles');
    await pool.query(`
      CREATE TABLE public.profiles (
        id uuid PRIMARY KEY,
        username text NOT NULL UNIQUE,
        bio text NOT NULL DEFAULT '',
        grow_points integer DEFAULT 0,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now(),
        role text DEFAULT 'user',
        recovery_email text
      )
    `);
  });

  beforeEach(async () => {
    await pool.query('DELETE FROM public.profiles');
  });

  afterAll(async () => {
    if (!pool) {
      return;
    }

    try {
      await pool.query('DROP TABLE IF EXISTS public.profiles');
    } finally {
      await pool.end();
    }
  });

  it('returns a mapped domain profile when a row exists', async () => {
    const id = randomUUID();

    await pool.query(
      `
        INSERT INTO public.profiles (
          id,
          username,
          bio,
          grow_points,
          role,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        id,
        'integration_grower',
        'Keep growing.',
        42,
        'admin',
        '2026-07-05T10:00:00.000Z',
        '2026-07-05T11:00:00.000Z',
      ],
    );

    const profile = await repository.findByUserId(id);

    expect(profile).toEqual({
      id,
      username: 'integration_grower',
      bio: 'Keep growing.',
      growPoints: 42,
      role: 'admin',
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(new Date(profile?.createdAt ?? '').toISOString()).toBe('2026-07-05T10:00:00.000Z');
    expect(new Date(profile?.updatedAt ?? '').toISOString()).toBe('2026-07-05T11:00:00.000Z');
  });

  it('returns null when no row exists', async () => {
    await expect(repository.findByUserId(randomUUID())).resolves.toBeNull();
  });

  it('preserves nullable read fields from the database row', async () => {
    const id = randomUUID();

    await pool.query(
      `
        INSERT INTO public.profiles (
          id,
          username,
          grow_points,
          role,
          created_at,
          updated_at
        )
        VALUES ($1, $2, NULL, NULL, NULL, NULL)
      `,
      [id, 'nullable_grower'],
    );

    await expect(repository.findByUserId(id)).resolves.toEqual({
      id,
      username: 'nullable_grower',
      bio: '',
      growPoints: null,
      role: null,
      createdAt: null,
      updatedAt: null,
    });
  });
});
