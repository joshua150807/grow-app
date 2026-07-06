import type { AuthUser } from '../../auth/types.js';
import { AppError } from '../../errors/appError.js';
import {
  betaRegistrationCompletionRequestSchema,
  betaRegistrationCompletionResponseSchema,
  type BetaRegistrationCompletionResponse,
} from './betaRegistrationSchemas.js';
import {
  createBetaRegistrationCompletionRepository,
  type BetaRegistrationCompletionRepository,
} from './betaRegistrationRepository.js';

export type BetaRegistrationCompletionService = {
  completeRegistration(
    user: AuthUser,
    input: unknown,
  ): Promise<BetaRegistrationCompletionResponse>;
};

function normalizeAuthEmail(email: string | null): string {
  const normalized = email?.trim().toLowerCase() ?? '';

  if (!normalized) {
    throw new AppError(
      409,
      'AUTH_EMAIL_MISSING',
      'Authenticated user email is required to complete beta registration.',
    );
  }

  return normalized;
}

export function createBetaRegistrationCompletionService(
  repository: BetaRegistrationCompletionRepository =
    createBetaRegistrationCompletionRepository(),
): BetaRegistrationCompletionService {
  return {
    async completeRegistration(
      user: AuthUser,
      input: unknown,
    ): Promise<BetaRegistrationCompletionResponse> {
      const parsedInput = betaRegistrationCompletionRequestSchema.parse(input);
      const recoveryEmail = normalizeAuthEmail(user.email);

      const profile = await repository.complete({
        userId: user.id,
        code: parsedInput.code,
        username: parsedInput.username,
        recoveryEmail,
      });

      return betaRegistrationCompletionResponseSchema.parse({
        status: 'completed',
        profile,
      });
    },
  };
}
