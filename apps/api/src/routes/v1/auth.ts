import type { FastifyPluginAsync } from 'fastify';
import {
  createBetaRegistrationCompletionService,
  type BetaRegistrationCompletionService,
} from '../../modules/betaRegistration/betaRegistrationService.js';

export type AuthRoutesOptions = {
  betaRegistrationCompletionService?: BetaRegistrationCompletionService;
};

export const authRoutes: FastifyPluginAsync<AuthRoutesOptions> = async (
  app,
  options,
) => {
  let runtimeBetaRegistrationCompletionService:
    BetaRegistrationCompletionService | null = null;

  function getBetaRegistrationCompletionService(): BetaRegistrationCompletionService {
    if (options.betaRegistrationCompletionService) {
      return options.betaRegistrationCompletionService;
    }

    runtimeBetaRegistrationCompletionService ??=
      createBetaRegistrationCompletionService();

    return runtimeBetaRegistrationCompletionService;
  }

  app.post('/auth/beta-registration/complete', {
    preHandler: [app.requireAuth],
  }, async (request) => getBetaRegistrationCompletionService().completeRegistration(
    request.auth.user!,
    request.body,
  ));
};
