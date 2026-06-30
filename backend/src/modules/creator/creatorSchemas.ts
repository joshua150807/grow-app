import { z } from 'zod';

const optionalText = (maxLength: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(maxLength)
    .optional();

export const creatorApplicationRequestSchema = z
  .object({
    motivation: z.string().trim().min(20).max(1000),
    experience: optionalText(1000),
    content_focus: optionalText(300),
    social_links: z
      .array(z.string().trim().url().max(500))
      .max(5)
      .optional(),
  })
  .strict();

export const creatorApplicationResponseSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  motivation: z.string(),
  experience: z.string().nullable(),
  content_focus: z.string().nullable(),
  social_links: z.array(z.string()).nullable(),
  status: z.string(),
  rejection_reason: z.string().nullable(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
});

export const myCreatorApplicationResponseSchema = z.object({
  status: z.string(),
  application: creatorApplicationResponseSchema.nullable(),
});

export type CreatorApplicationInput = z.infer<typeof creatorApplicationRequestSchema>;
export type CreatorApplicationResponse = z.infer<typeof creatorApplicationResponseSchema>;
export type MyCreatorApplicationResponse = z.infer<typeof myCreatorApplicationResponseSchema>;
