import { describe, expect, it, vi } from 'vitest';
import type { Profile } from '../src/modules/profiles/domain/profile.js';
import type { ProfilesReadRepository } from '../src/modules/profiles/repositories/profilesReadRepository.js';
import { ProfileReadService } from '../src/modules/profiles/services/profileReadService.js';

function createRepository(profile: Profile | null): ProfilesReadRepository {
  return {
    findByUserId: vi.fn(async () => profile),
  };
}

describe('ProfileReadService', () => {
  it('returns a public read DTO when a profile exists', async () => {
    const repository = createRepository({
      id: 'user-123',
      username: 'grower',
      bio: 'Keep growing.',
      avatarPath: null,
      growPoints: 12,
      role: 'user',
      createdAt: '2026-07-05T10:00:00.000Z',
      updatedAt: '2026-07-05T11:00:00.000Z',
    });
    const service = new ProfileReadService(repository);

    await expect(service.getByUserId('user-123')).resolves.toEqual({
      id: 'user-123',
      username: 'grower',
      bio: 'Keep growing.',
      avatar_url: null,
      grow_points: 12,
      role: 'user',
      created_at: '2026-07-05T10:00:00.000Z',
      updated_at: '2026-07-05T11:00:00.000Z',
    });
  });

  it('returns null when no profile exists', async () => {
    const repository = createRepository(null);
    const service = new ProfileReadService(repository);

    await expect(service.getByUserId('missing-user')).resolves.toBeNull();
  });

  it('passes the exact user id to the read repository', async () => {
    const repository = createRepository(null);
    const service = new ProfileReadService(repository);

    await service.getByUserId('user-123');

    expect(repository.findByUserId).toHaveBeenCalledWith('user-123');
  });

  it('preserves nullable domain values in the DTO', async () => {
    const repository = createRepository({
      id: 'user-123',
      username: 'grower',
      bio: '',
      avatarPath: null,
      growPoints: null,
      role: null,
      createdAt: null,
      updatedAt: null,
    });
    const service = new ProfileReadService(repository);

    await expect(service.getByUserId('user-123')).resolves.toEqual({
      id: 'user-123',
      username: 'grower',
      bio: '',
      avatar_url: null,
      grow_points: null,
      role: null,
      created_at: null,
      updated_at: null,
    });
  });

  it('does not expose private or legacy profile fields', async () => {
    const repository = createRepository({
      id: 'user-123',
      username: 'grower',
      bio: '',
      avatarPath: null,
      growPoints: 12,
      role: 'user',
      createdAt: null,
      updatedAt: null,
    });
    const service = new ProfileReadService(repository);

    const dto = await service.getByUserId('user-123');

    expect(dto).not.toHaveProperty('recovery_email');
    expect(dto).not.toHaveProperty('user_id');
    expect(dto).not.toHaveProperty('display_name');
    expect(dto).not.toHaveProperty('name');
    expect(dto).toHaveProperty('avatar_url', null);
    expect(dto).toHaveProperty('bio', '');
    expect(dto).not.toHaveProperty('avatarPath');
  });
});
