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
  avatar_url: z.string().url().nullable(),
});

export const avatarUploadRequestSchema = z.object({
  mime_type: z.enum(['image/jpeg', 'image/png', 'image/webp']),
}).strict();

export const avatarConfirmRequestSchema = z.object({
  path: z.string().regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpg|jpeg|png|webp)$/i,
    'Avatar path is invalid.',
  ),
}).strict();

export type ProfileUpdateInput = z.infer<typeof profileUpdateRequestSchema>;
export type BaseProfileResponse = z.infer<typeof baseProfileResponseSchema>;
export type ProfileResponse = z.infer<typeof profileResponseSchema>;
export type AvatarUploadInput = z.infer<typeof avatarUploadRequestSchema>;
export type AvatarConfirmInput = z.infer<typeof avatarConfirmRequestSchema>;
