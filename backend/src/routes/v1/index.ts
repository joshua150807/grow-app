import type { FastifyPluginAsync } from 'fastify';
import { healthRoutes } from './health.js';
import { meRoutes } from './me.js';

export const v1Routes: FastifyPluginAsync = async (app) => {
  await app.register(healthRoutes);
  await app.register(meRoutes);
};
