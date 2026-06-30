import type { FastifyPluginAsync } from 'fastify';
import {
  createCreatorService,
  type CreatorService,
} from '../../modules/creator/creatorService.js';

export type CreatorRoutesOptions = {
  creatorService?: CreatorService;
};

export const creatorRoutes: FastifyPluginAsync<CreatorRoutesOptions> = async (
  app,
  options,
) => {
  app.get('/creator/applications/me', {
    preHandler: [app.requireAuth],
  }, async (request) => (
    await (options.creatorService ?? createCreatorService())
      .getMyCreatorApplication(request.auth.user!)
  ));

  app.post('/creator/applications', {
    preHandler: [app.requireAuth],
  }, async (request, reply) => {
    const application = await (options.creatorService ?? createCreatorService())
      .createCreatorApplication(request.auth.user!, request.body);

    return reply.status(201).send({
      application,
    });
  });
};
