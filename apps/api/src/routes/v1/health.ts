import type { FastifyPluginAsync } from 'fastify';
import { config } from '../../config/index.js';

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/health', async () => ({
    status: 'ok',
    service: 'grow-backend',
    environment: config.NODE_ENV,
    uptimeSeconds: Math.floor(process.uptime()),
  }));
};
