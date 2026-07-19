import { z } from 'zod';

export const MAX_DEEP_WORK_DURATION_SECONDS = 86_340;
export const MAX_CLIENT_SESSION_ID_LENGTH = 128;

export const profileStatsQuerySchema = z.object({
  timezone: z.string().min(1).refine((value) => {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
      return true;
    } catch {
      return false;
    }
  }, 'Timezone must be a valid IANA timezone.'),
}).strict();

export const deepWorkSessionRequestSchema = z.object({
  client_session_id: z.string().trim().min(1).max(MAX_CLIENT_SESSION_ID_LENGTH),
  duration_seconds: z.number().int().positive().max(MAX_DEEP_WORK_DURATION_SECONDS),
  completed_at: z.string().datetime({ offset: true }),
}).strict();

export type DeepWorkSessionInput = z.infer<typeof deepWorkSessionRequestSchema>;
