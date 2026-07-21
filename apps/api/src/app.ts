import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { config } from './config/index.js';
import { errorHandler } from './errors/errorHandler.js';
import { notFoundHandler } from './errors/notFoundHandler.js';
import { createLoggerOptions } from './logger/logger.js';
import { authPlugin } from './middleware/auth.js';
import { v1Routes } from './routes/v1/index.js';
import type { AuthTokenVerifier } from './auth/types.js';
import type {
  BetaRegistrationCompletionService,
} from './modules/betaRegistration/betaRegistrationService.js';
import type { CreatorService } from './modules/creator/creatorService.js';
import type { ProfileService } from './modules/profiles/profileService.js';
import type { ProfileStatsService } from './modules/profileStats/profileStatsService.js';
import type { DeepWorkSessionService } from './modules/profileStats/deepWorkSessionService.js';
import type { HabitCollectionService } from './modules/habitCollections/habitCollectionService.js';

export type BuildAppOptions = {
  authTokenVerifier?: AuthTokenVerifier;
  betaRegistrationCompletionService?: BetaRegistrationCompletionService;
  creatorService?: CreatorService;
  profileService?: ProfileService;
  profileStatsService?: ProfileStatsService;
  deepWorkSessionService?: DeepWorkSessionService;
  habitCollectionService?: HabitCollectionService;
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
    betaRegistrationCompletionService: options.betaRegistrationCompletionService,
    creatorService: options.creatorService,
    profileService: options.profileService,
    profileStatsService: options.profileStatsService,
    deepWorkSessionService: options.deepWorkSessionService,
    habitCollectionService: options.habitCollectionService,
  });

  return app;
}
