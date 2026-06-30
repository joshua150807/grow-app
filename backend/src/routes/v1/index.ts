import type { FastifyPluginAsync } from 'fastify';
import type { CreatorService } from '../../modules/creator/creatorService.js';
import type { ProfileService } from '../../modules/profiles/profileService.js';
import { creatorRoutes } from './creator.js';
import { healthRoutes } from './health.js';
import { meRoutes } from './me.js';
import { profileRoutes } from './profile.js';

export type V1RoutesOptions = {
  creatorService?: CreatorService;
  profileService?: ProfileService;
};

export const v1Routes: FastifyPluginAsync<V1RoutesOptions> = async (app, options) => {
  await app.register(healthRoutes);
  await app.register(meRoutes);
  await app.register(creatorRoutes, {
    creatorService: options.creatorService,
  });
  await app.register(profileRoutes, {
    profileService: options.profileService,
  });
};
