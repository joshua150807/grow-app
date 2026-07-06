import type { FastifyPluginAsync } from 'fastify';

export const meRoutes: FastifyPluginAsync = async (app) => {
  app.get('/me', {
    preHandler: [app.requireAuth],
  }, async (request) => ({
    user: request.auth.user,
  }));
};
