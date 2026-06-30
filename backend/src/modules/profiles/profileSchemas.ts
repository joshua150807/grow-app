import { z } from 'zod';

export const profileResponseSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  username: z.string().nullable(),
  display_name: z.string().nullable(),
  name: z.string().nullable(),
  avatar_url: z.string().nullable(),
  role: z.string().nullable(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
});

export type ProfileResponse = z.infer<typeof profileResponseSchema>;
