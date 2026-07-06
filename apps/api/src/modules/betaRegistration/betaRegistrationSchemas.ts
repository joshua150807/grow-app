import { z } from 'zod';
import { profileResponseSchema } from '../profiles/profileSchemas.js';

export const betaRegistrationCompletionRequestSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(1)
      .transform((value) => value.toUpperCase()),
    username: z
      .string()
      .trim()
      .min(3)
      .max(30)
      .regex(/^[a-zA-Z0-9_]+$/, 'Username may only contain letters, numbers and underscores.')
      .transform((value) => value.toLowerCase()),
  })
  .strict();

export const betaRegistrationCompletionResponseSchema = z.object({
  status: z.literal('completed'),
  profile: profileResponseSchema,
});

export type BetaRegistrationCompletionInput =
  z.infer<typeof betaRegistrationCompletionRequestSchema>;
export type BetaRegistrationCompletionResponse =
  z.infer<typeof betaRegistrationCompletionResponseSchema>;
