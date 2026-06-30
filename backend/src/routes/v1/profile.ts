import type { FastifyPluginAsync } from 'fastify';
import {
  createProfileService,
  type ProfileService,
} from '../../modules/profiles/profileService.js';

export type ProfileRoutesOptions = {
  profileService?: ProfileService;
};

export const profileRoutes: FastifyPluginAsync<ProfileRoutesOptions> = async (
  app,
  options,
) => {
  app.get('/profile/me', {
    preHandler: [app.requireAuth],
  }, async (request) => ({
    profile: await (options.profileService ?? createProfileService())
      .getCurrentUserProfile(request.auth.user!),
  }));

  app.patch('/profile/me', {
    preHandler: [app.requireAuth],
  }, async (request) => ({
    profile: await (options.profileService ?? createProfileService())
      .updateCurrentUserProfile(request.auth.user!, request.body),
  }));
};
