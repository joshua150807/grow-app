import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { config } from './config/index.js';
import { errorHandler } from './errors/errorHandler.js';
import { notFoundHandler } from './errors/notFoundHandler.js';
import { createLoggerOptions } from './logger/logger.js';
import { authPlugin } from './middleware/auth.js';
import { v1Routes } from './routes/v1/index.js';
import type { AuthTokenVerifier } from './auth/types.js';
import type { ProfileService } from './modules/profiles/profileService.js';

export type BuildAppOptions = {
  authTokenVerifier?: AuthTokenVerifier;
  profileService?: ProfileService;
};

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({
    logger: createLoggerOptions(config),
    requestIdHeader: 'x-request-id',
  });

  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler(notFoundHandler);

  app.register(authPlugin, {
    verifyToken: options.authTokenVerifier,
  });
  app.register(v1Routes, {
    prefix: '/v1',
    profileService: options.profileService,
  });

  return app;
}
