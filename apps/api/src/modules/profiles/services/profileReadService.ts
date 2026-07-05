import {
  mapProfileDomainToReadDto,
  type ProfileReadDto,
} from '../mappers/profileMapper.js';
import type { ProfilesReadRepository } from '../repositories/profilesReadRepository.js';

export class ProfileReadService {
  constructor(private readonly profilesRepository: ProfilesReadRepository) {}

  async getByUserId(userId: string): Promise<ProfileReadDto | null> {
    const profile = await this.profilesRepository.findByUserId(userId);

    return profile ? mapProfileDomainToReadDto(profile) : null;
  }
}
