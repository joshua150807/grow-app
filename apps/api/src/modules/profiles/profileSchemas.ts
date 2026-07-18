import { z } from 'zod';

export const profileUpdateRequestSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(3)
      .max(30)
      .regex(/^[a-zA-Z0-9_]+$/, 'Username may only contain letters, numbers and underscores.')
      .transform((value) => value.toLowerCase())
      .optional(),
    bio: z
      .string()
      .trim()
      .max(100)
      .optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one profile field must be provided.',
  });

export const baseProfileResponseSchema = z.object({
  id: z.string(),
  username: z.string(),
  grow_points: z.number().int().nullable(),
  role: z.string().nullable(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
});

export const profileResponseSchema = baseProfileResponseSchema.extend({
  bio: z.string(),
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateRequestSchema>;
export type BaseProfileResponse = z.infer<typeof baseProfileResponseSchema>;
export type ProfileResponse = z.infer<typeof profileResponseSchema>;
