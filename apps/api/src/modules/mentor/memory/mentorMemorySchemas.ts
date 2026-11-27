import { z } from 'zod';

export const MENTOR_MEMORY_CATEGORIES = [
  'goals',
  'health',
  'training',
  'habits',
  'business',
  'learning',
  'preferences',
  'personal',
  'challenges',
  'other',
] as const;

export const MENTOR_MEMORY_CONTENT_MAX_LENGTH = 300;
export const MENTOR_MEMORY_MAX_OPERATIONS = 3;

export const mentorMemoryCategorySchema = z.enum(MENTOR_MEMORY_CATEGORIES);
export const mentorMemoryStatusSchema = z.enum(['active', 'resolved']);

export type MentorMemoryCategory = z.infer<typeof mentorMemoryCategorySchema>;
export type MentorMemoryStatus = z.infer<typeof mentorMemoryStatusSchema>;

const memoryContentSchema = z
  .string()
  .transform((value) => value.normalize('NFC').replace(/\s+/g, ' ').trim())
  .pipe(z.string().min(1).max(MENTOR_MEMORY_CONTENT_MAX_LENGTH));

export const mentorMemoryIdSchema = z.string().uuid();

export const updateMentorMemoryRequestSchema = z
  .object({
    content: memoryContentSchema.optional(),
    status: mentorMemoryStatusSchema.optional(),
  })
  .strict()
  .refine((value) => value.content !== undefined || value.status !== undefined, 'Nothing to update.');

export const updateMentorSettingsRequestSchema = z
  .object({
    memory_enabled: z.boolean().optional(),
    journal_access_enabled: z.boolean().optional(),
    notes_access_enabled: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.values(value).some((entry) => entry !== undefined), 'Nothing to update.');

/** JSON schema sent to the LLM for structured output. */
export const memoryExtractionJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['operations'],
  properties: {
    operations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'id', 'category', 'content'],
        properties: {
          type: { type: 'string', enum: ['add', 'update', 'resolve'] },
          id: { type: 'string', description: 'Existing memory id for update/resolve, empty string for add.' },
          category: { type: 'string', enum: [...MENTOR_MEMORY_CATEGORIES] },
          content: { type: 'string', description: 'The fact, max 300 characters. Empty string for resolve.' },
        },
      },
    },
  },
} as const;
