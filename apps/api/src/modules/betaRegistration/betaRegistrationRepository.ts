import { sql } from 'drizzle-orm';
import { AppError } from '../../errors/appError.js';
import { getDb, type ApiDatabase } from '../../db/client.js';
import type { BaseProfileResponse } from '../profiles/profileSchemas.js';

type TimestampValue = string | Date | null;

type CodeRow = {
  id: string;
  code: string;
  used_by: string | null;
  used_at: TimestampValue;
  created_at: TimestampValue;
};

type ProfilePersistenceRow = {
  id: string;
  username: string;
  grow_points: number | null;
  role: string | null;
  created_at: TimestampValue;
  updated_at: TimestampValue;
  recovery_email: string | null;
};

export type CompleteBetaRegistrationDbInput = {
  userId: string;
  code: string;
  username: string;
  recoveryEmail: string;
};

export type BetaRegistrationCompletionRepository = {
  complete(input: CompleteBetaRegistrationDbInput): Promise<BaseProfileResponse>;
};

type QueryResult<T> = {
  rows?: T[];
};

function getRows<T>(result: unknown): T[] {
  const candidate = result as QueryResult<T>;

  if (Array.isArray(candidate.rows)) {
    return candidate.rows;
  }

  if (Array.isArray(result)) {
    return result as T[];
  }

  return [];
}

function normalizeTimestamp(value: TimestampValue): string | null {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
}

function toProfileResponse(row: ProfilePersistenceRow): BaseProfileResponse {
  return {
    id: row.id,
    username: row.username,
    grow_points: row.grow_points,
    role: row.role,
    created_at: normalizeTimestamp(row.created_at),
    updated_at: normalizeTimestamp(row.updated_at),
  };
}

function isLegacyFallbackProfile(profile: ProfilePersistenceRow, userId: string): boolean {
  return profile.id === userId
    && profile.username === `user_${userId.slice(0, 6)}`
    && profile.recovery_email === null
    && profile.role === 'user'
    && profile.grow_points === 0;
}

function isSameUser(left: string | null, right: string): boolean {
  return left === right;
}

function isSameEmail(left: string | null, right: string): boolean {
  return typeof left === 'string' && left.toLowerCase() === right;
}

function throwCodeInvalid(): never {
  throw new AppError(409, 'CODE_INVALID', 'Beta code is invalid or unavailable.');
}

function throwRegistrationStateConflict(): never {
  throw new AppError(
    409,
    'REGISTRATION_STATE_CONFLICT',
    'Beta registration state is inconsistent.',
  );
}

function throwProfileStateConflict(): never {
  throw new AppError(
    409,
    'PROFILE_STATE_CONFLICT',
    'Profile state cannot be completed automatically.',
  );
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && (error as { code?: unknown }).code === '23505');
}

function getErrorText(error: unknown): string {
  if (!error || typeof error !== 'object') return '';

  const candidate = error as {
    constraint?: unknown;
    message?: unknown;
    detail?: unknown;
    details?: unknown;
  };

  return [
    candidate.constraint,
    candidate.message,
    candidate.detail,
    candidate.details,
  ]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase();
}

function mapUniqueViolation(error: unknown): never {
  const text = getErrorText(error);

  if (text.includes('recovery_email')) {
    throw new AppError(409, 'EMAIL_TAKEN', 'Recovery email is already taken.');
  }

  if (text.includes('username')) {
    throw new AppError(409, 'USERNAME_TAKEN', 'Username is already taken.');
  }

  throw error;
}

export function createBetaRegistrationCompletionRepository(
  db: ApiDatabase = getDb(),
): BetaRegistrationCompletionRepository {
  return {
    async complete(input): Promise<BaseProfileResponse> {
      try {
        return await db.transaction(async (tx) => {
          const codeRows = getRows<CodeRow>(await tx.execute(sql`
            select id, code, used_by, used_at, created_at
            from public.beta_access_codes
            where upper(code) = ${input.code}
            for update
          `));

          if (codeRows.length !== 1) {
            throwCodeInvalid();
          }

          const code = codeRows[0]!;

          const profileRows = getRows<ProfilePersistenceRow>(await tx.execute(sql`
            select id, username, grow_points, role, recovery_email, created_at, updated_at
            from public.profiles
            where id = ${input.userId}
            for update
          `));
          const profile = profileRows[0] ?? null;

          if (
            (code.used_by !== null && code.used_at === null)
            || (code.used_by === null && code.used_at !== null)
          ) {
            throwRegistrationStateConflict();
          }

          if (code.used_by !== null && code.used_at !== null) {
            if (!isSameUser(code.used_by, input.userId)) {
              throwCodeInvalid();
            }

            if (!profile || !isSameEmail(profile.recovery_email, input.recoveryEmail)) {
              throwRegistrationStateConflict();
            }

            return toProfileResponse(profile);
          }

          const usernameConflicts = getRows<{ id: string }>(await tx.execute(sql`
            select id
            from public.profiles
            where lower(username) = lower(${input.username})
              and id <> ${input.userId}
            limit 1
          `));

          if (usernameConflicts.length > 0) {
            throw new AppError(409, 'USERNAME_TAKEN', 'Username is already taken.');
          }

          const emailConflicts = getRows<{ id: string }>(await tx.execute(sql`
            select id
            from public.profiles
            where recovery_email is not null
              and lower(recovery_email) = lower(${input.recoveryEmail})
              and id <> ${input.userId}
            limit 1
          `));

          if (emailConflicts.length > 0) {
            throw new AppError(409, 'EMAIL_TAKEN', 'Recovery email is already taken.');
          }

          let completedProfile: ProfilePersistenceRow;

          if (!profile) {
            const insertedProfileRows = getRows<ProfilePersistenceRow>(await tx.execute(sql`
              insert into public.profiles (
                id,
                username,
                grow_points,
                role,
                recovery_email
              )
              values (
                ${input.userId},
                ${input.username},
                0,
                'user',
                ${input.recoveryEmail}
              )
              returning id, username, grow_points, role, recovery_email, created_at, updated_at
            `));

            completedProfile = insertedProfileRows[0]!;
          } else if (isLegacyFallbackProfile(profile, input.userId)) {
            const updatedProfileRows = getRows<ProfilePersistenceRow>(await tx.execute(sql`
              update public.profiles
              set username = ${input.username},
                  recovery_email = ${input.recoveryEmail},
                  updated_at = now()
              where id = ${input.userId}
              returning id, username, grow_points, role, recovery_email, created_at, updated_at
            `));

            completedProfile = updatedProfileRows[0]!;
          } else {
            throwProfileStateConflict();
          }

          await tx.execute(sql`
            update public.beta_access_codes
            set used_by = ${input.userId},
                used_at = now()
            where id = ${code.id}
          `);

          return toProfileResponse(completedProfile);
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          mapUniqueViolation(error);
        }

        throw error;
      }
    },
  };
}
