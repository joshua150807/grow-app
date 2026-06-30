import { z } from 'zod';

const optionalTrimmedString = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength)
    .optional();

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
    display_name: optionalTrimmedString(80),
    name: optionalTrimmedString(80),
    avatar_url: z.string().trim().url().max(500).optional(),
    bio: optionalTrimmedString(300),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one profile field must be provided.',
  });

export const profileResponseSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  username: z.string().nullable(),
  display_name: z.string().nullable(),
  name: z.string().nullable(),
  avatar_url: z.string().nullable(),
  bio: z.string().nullable(),
  role: z.string().nullable(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateRequestSchema>;
export type ProfileResponse = z.infer<typeof profileResponseSchema>;
