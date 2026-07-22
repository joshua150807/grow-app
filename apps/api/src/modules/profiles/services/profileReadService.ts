import {
  mapProfileDomainToReadDto,
  type ProfileReadDto,
} from '../mappers/profileMapper.js';
import type { ProfilesReadRepository } from '../repositories/profilesReadRepository.js';
import type { Profile } from '../domain/profile.js';

export class ProfileReadService {
  constructor(private readonly profilesRepository: ProfilesReadRepository) {}

  async getByUserId(userId: string): Promise<ProfileReadDto | null> {
    const profile = await this.getDomainByUserId(userId);

    return profile ? mapProfileDomainToReadDto(profile) : null;
  }

  getDomainByUserId(userId: string): Promise<Profile | null> {
    return this.profilesRepository.findByUserId(userId);
  }
}
