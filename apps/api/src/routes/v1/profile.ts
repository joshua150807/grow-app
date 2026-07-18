import type { FastifyPluginAsync } from 'fastify';
import type { ProfileService } from '../../modules/profiles/profileService.js';
import { createRuntimeProfileService } from '../../modules/profiles/profileRuntime.js';

export type ProfileRoutesOptions = {
  profileService?: ProfileService;
};

export const profileRoutes: FastifyPluginAsync<ProfileRoutesOptions> = async (
  app,
  options,
) => {
  let runtimeProfileService: ProfileService | null = null;

  function getProfileService(): ProfileService {
    if (options.profileService) {
      return options.profileService;
    }

    runtimeProfileService ??= createRuntimeProfileService((context, message) => {
      app.log.warn(context, message);
    });

    return runtimeProfileService;
  }

  app.get('/profile/me', {
    preHandler: [app.requireAuth],
  }, async (request) => ({
    profile: await getProfileService().getCurrentUserProfile(request.auth.user!),
  }));

  app.patch('/profile/me', {
    preHandler: [app.requireAuth],
  }, async (request) => ({
    profile: await getProfileService().updateCurrentUserProfile(request.auth.user!, request.body),
  }));

  app.post('/profile/me/avatar/upload', {
    preHandler: [app.requireAuth],
  }, async (request) => ({
    upload: await getProfileService().createAvatarUpload(request.auth.user!, request.body),
  }));

  app.post('/profile/me/avatar/confirm', {
    preHandler: [app.requireAuth],
  }, async (request) => ({
    profile: await getProfileService().confirmAvatarUpload(request.auth.user!, request.body),
  }));

  app.delete('/profile/me/avatar', {
    preHandler: [app.requireAuth],
  }, async (request) => ({
    profile: await getProfileService().deleteAvatar(request.auth.user!),
  }));
};
