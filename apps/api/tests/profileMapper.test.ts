import { describe, expect, it } from 'vitest';
import type { Profile } from '../src/modules/profiles/domain/profile.js';
import {
  mapProfileDomainToReadDto,
  mapProfilePersistenceRowToDomain,
  type ProfilePersistenceRow,
} from '../src/modules/profiles/mappers/profileMapper.js';

describe('profile mappers', () => {
  it('maps a persistence row to the domain model without adding fields', () => {
    const row: ProfilePersistenceRow = {
      id: 'user-123',
      username: 'grower',
      growPoints: 42,
      role: 'user',
      createdAt: '2026-07-05T10:00:00.000Z',
      updatedAt: '2026-07-05T11:00:00.000Z',
    };

    const profile = mapProfilePersistenceRowToDomain(row);

    expect(profile).toEqual({
      id: 'user-123',
      username: 'grower',
      growPoints: 42,
      role: 'user',
      createdAt: '2026-07-05T10:00:00.000Z',
      updatedAt: '2026-07-05T11:00:00.000Z',
    });
    expect(Object.keys(profile).sort()).toEqual([
      'createdAt',
      'growPoints',
      'id',
      'role',
      'updatedAt',
      'username',
    ]);
  });

  it('preserves nullable persistence values in the domain model', () => {
    const row: ProfilePersistenceRow = {
      id: 'user-123',
      username: 'grower',
      growPoints: null,
      role: null,
      createdAt: null,
      updatedAt: null,
    };

    expect(mapProfilePersistenceRowToDomain(row)).toEqual({
      id: 'user-123',
      username: 'grower',
      growPoints: null,
      role: null,
      createdAt: null,
      updatedAt: null,
    });
  });

  it('maps the domain model to the public read DTO without private or future fields', () => {
    const profile: Profile = {
      id: 'user-123',
      username: 'grower',
      growPoints: null,
      role: null,
      createdAt: null,
      updatedAt: '2026-07-05T11:00:00.000Z',
    };

    const dto = mapProfileDomainToReadDto(profile);

    expect(dto).toEqual({
      id: 'user-123',
      username: 'grower',
      grow_points: null,
      role: null,
      created_at: null,
      updated_at: '2026-07-05T11:00:00.000Z',
    });
    expect(dto).not.toHaveProperty('recovery_email');
    expect(dto).not.toHaveProperty('user_id');
    expect(dto).not.toHaveProperty('display_name');
    expect(dto).not.toHaveProperty('name');
    expect(dto).not.toHaveProperty('avatar_url');
    expect(dto).not.toHaveProperty('bio');
  });
});
