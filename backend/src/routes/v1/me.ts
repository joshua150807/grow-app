import type { FastifyPluginAsync } from 'fastify';

export const meRoutes: FastifyPluginAsync = async (app) => {
  app.get('/me', async (request) => ({
    authenticated: Boolean(request.auth.token),
    user: request.auth.user,
    profile: null,
    message: 'Profile loading is not implemented yet.',
  }));
};
