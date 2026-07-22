import type { FastifyPluginAsync } from 'fastify';
import type { ProfileService } from '../../modules/profiles/profileService.js';
import { createRuntimeProfileService } from '../../modules/profiles/profileRuntime.js';
import { createProfileStatsService, type ProfileStatsService } from '../../modules/profileStats/profileStatsService.js';
import { createDeepWorkSessionService, type DeepWorkSessionService } from '../../modules/profileStats/deepWorkSessionService.js';

export type ProfileRoutesOptions = {
  profileService?: ProfileService;
  profileStatsService?: ProfileStatsService;
  deepWorkSessionService?: DeepWorkSessionService;
};

export const profileRoutes: FastifyPluginAsync<ProfileRoutesOptions> = async (
  app,
  options,
) => {
  let runtimeProfileService: ProfileService | null = null;
  let runtimeProfileStatsService: ProfileStatsService | null = null;
  let runtimeDeepWorkSessionService: DeepWorkSessionService | null = null;

  function getProfileService(): ProfileService {
    if (options.profileService) {
      return options.profileService;
    }

    runtimeProfileService ??= createRuntimeProfileService((context, message) => {
      app.log.warn(context, message);
    });

    return runtimeProfileService;
  }

  const getStatsService = () => options.profileStatsService
    ?? (runtimeProfileStatsService ??= createProfileStatsService());
  const getDeepWorkService = () => options.deepWorkSessionService
    ?? (runtimeDeepWorkSessionService ??= createDeepWorkSessionService());

  app.get('/profile/me/stats', { preHandler: [app.requireAuth] }, async (request) => ({
    stats: await getStatsService().get(request.auth.user!, request.query),
  }));

  app.post('/profile/me/deep-work/sessions', { preHandler: [app.requireAuth] }, async (request, reply) => {
    const result = await getDeepWorkService().create(request.auth.user!, request.body);
    return reply.code(result.created ? 201 : 200).send(result);
  });

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
