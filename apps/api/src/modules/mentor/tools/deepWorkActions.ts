import { z } from 'zod';
import type { MentorActionContext, MentorActionDefinition } from '../actions/mentorActionRegistry.js';
import { dateKey, localParts } from '../../profileStats/timezone.js';
import { iso, type Queryable } from './toolShared.js';

/**
 * Deep work is read-only for the mentor on purpose: sessions are written only
 * by the timer through the backend so focus statistics cannot be faked.
 */
export function createDeepWorkActions(db: () => Queryable, context: MentorActionContext): MentorActionDefinition[] {
  const statsSchema = z.object({ days: z.number().int().min(1).max(90).default(30) }).strict();

  return [
    {
      type: 'deep_work.stats',
      kind: 'read',
      description: "Read the user's completed deep work (focus timer) sessions: totals and minutes per day for the last N days (default 30). Deep work cannot be logged by the mentor.",
      inputSchema: statsSchema,
      jsonSchema: {
        type: 'object',
        additionalProperties: false,
        properties: { days: { type: 'integer', minimum: 1, maximum: 90 } },
      },
      summarize: () => 'Deep-Work-Statistik lesen',
      async execute(userId, input: z.infer<typeof statsSchema>) {
        const now = context.now();
        const since = new Date(now.getTime() - input.days * 86_400_000);
        const result = await db().query<{ duration_seconds: number; completed_at: Date | string }>(
          `select duration_seconds, completed_at from public.deep_work_sessions
           where user_id = $1 and completed_at >= $2 and completed_at <= $3
           order by completed_at desc
           limit 1000`,
          [userId, since, now],
        );
        const perDay = new Map<string, number>();
        let totalSeconds = 0;
        for (const session of result.rows) {
          totalSeconds += session.duration_seconds;
          const day = dateKey(localParts(new Date(session.completed_at), context.timeZone));
          perDay.set(day, (perDay.get(day) ?? 0) + session.duration_seconds);
        }
        return {
          data: {
            window_days: input.days,
            sessions: result.rows.length,
            total_minutes: Math.round(totalSeconds / 60),
            average_minutes_per_session: result.rows.length ? Math.round(totalSeconds / 60 / result.rows.length) : 0,
            minutes_per_day: [...perDay.entries()]
              .sort(([a], [b]) => (a < b ? 1 : -1))
              .map(([day, seconds]) => ({ day, minutes: Math.round(seconds / 60) })),
            last_session_at: iso(result.rows[0]?.completed_at ?? null),
          },
        };
      },
    },
  ];
}
