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

export const creatorApplicationStatusSchema = z.enum([
  'pending',
  'requested',
  'approved',
  'rejected',
  'suspended',
]);

export const listCreatorApplicationsQuerySchema = z
  .object({
    status: creatorApplicationStatusSchema.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    page: z.coerce.number().int().min(0).default(0),
  })
  .strict();

export const creatorApplicationDecisionRequestSchema = z
  .object({
    decision: z.enum(['approved', 'rejected']),
    rejection_reason: z.string().trim().min(1).max(500).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.decision === 'rejected' && !value.rejection_reason) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'rejection_reason is required when decision is rejected.',
        path: ['rejection_reason'],
      });
    }
  });

export const myCreatorApplicationResponseSchema = z.object({
  status: z.string(),
  application: creatorApplicationResponseSchema.nullable(),
});

export const listCreatorApplicationsResponseSchema = z.object({
  applications: z.array(creatorApplicationResponseSchema),
  pagination: z.object({
    limit: z.number().int(),
    page: z.number().int(),
    has_more: z.boolean(),
  }),
});

export type CreatorApplicationInput = z.infer<typeof creatorApplicationRequestSchema>;
export type CreatorApplicationDecisionInput = z.infer<typeof creatorApplicationDecisionRequestSchema>;
export type CreatorApplicationResponse = z.infer<typeof creatorApplicationResponseSchema>;
export type CreatorApplicationStatusInput = z.infer<typeof creatorApplicationStatusSchema>;
export type ListCreatorApplicationsQuery = z.infer<typeof listCreatorApplicationsQuerySchema>;
export type ListCreatorApplicationsResponse = z.infer<typeof listCreatorApplicationsResponseSchema>;
export type MyCreatorApplicationResponse = z.infer<typeof myCreatorApplicationResponseSchema>;
