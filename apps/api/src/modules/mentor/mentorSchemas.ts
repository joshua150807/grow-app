import { z } from 'zod';

export const MENTOR_MESSAGE_MAX_LENGTH = 4000;

// Control characters except tab, line feed and carriage return.
// eslint-disable-next-line no-control-regex
const FORBIDDEN_CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

export const mentorMessageContentSchema = z
  .string({ required_error: 'Message is required.' })
  .transform((value) => value.normalize('NFC').trim())
  .pipe(
    z
      .string()
      .min(1, 'Message must not be empty.')
      .max(MENTOR_MESSAGE_MAX_LENGTH, `Message must be at most ${MENTOR_MESSAGE_MAX_LENGTH} characters.`)
      .refine((value) => !FORBIDDEN_CONTROL_CHARACTERS.test(value), 'Message contains invalid characters.'),
  );

export const mentorConversationIdSchema = z.string().uuid();

export const sendMentorMessageRequestSchema = z
  .object({
    conversation_id: mentorConversationIdSchema.optional(),
    content: mentorMessageContentSchema,
  })
  .strict();

export type SendMentorMessageRequest = z.infer<typeof sendMentorMessageRequestSchema>;

export const MENTOR_CONVERSATION_TITLE_MAX_LENGTH = 80;

export const renameMentorConversationRequestSchema = z
  .object({
    title: z
      .string()
      .transform((value) => value.normalize('NFC').replace(/\s+/g, ' ').trim())
      .pipe(z.string().min(1).max(MENTOR_CONVERSATION_TITLE_MAX_LENGTH)),
  })
  .strict();

export const listMentorConversationsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).default(20),
    page: z.coerce.number().int().min(0).max(1000).default(0),
  })
  .strict();

export const listMentorMessagesQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    before: mentorConversationIdSchema.optional(),
  })
  .strict();

export const MENTOR_CONSENT_VERSION = 'v1';

export const grantMentorConsentRequestSchema = z
  .object({
    version: z.literal(MENTOR_CONSENT_VERSION),
  })
  .strict();
