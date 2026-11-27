import { z } from 'zod';
import { AppError } from '../../../errors/appError.js';
import type { MentorActionContext, MentorActionDefinition } from '../actions/mentorActionRegistry.js';
import { formatGermanDate, iso, localDateKey, type Queryable } from './toolShared.js';

const FIELD_MAX = 2000;
const READ_FIELD_MAX = 1000;

const fieldSchema = z
  .string()
  .transform((value) => value.normalize('NFC').trim())
  .pipe(z.string().min(1).max(FIELD_MAX));

function clip(value: string | null, max = READ_FIELD_MAX): string | null {
  if (!value) return value;
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

/**
 * Journal entries are private: both tools require the user's
 * "journal_access_enabled" switch. The mentor can add an entry (e.g. a summary
 * the user asked for) but never edits or deletes existing ones.
 */
export function createJournalActions(db: () => Queryable, context: MentorActionContext): MentorActionDefinition[] {
  const listSchema = z.object({ days: z.number().int().min(1).max(60).default(14) }).strict();

  const createSchema = z.object({
    day: z.enum(['today', 'yesterday']).default('today'),
    gratitude: fieldSchema.optional(),
    did_well: fieldSchema.optional(),
    improve_tomorrow: fieldSchema.optional(),
    habits_completed: z.boolean().optional(),
    missed_habits: fieldSchema.optional(),
  }).strict().refine(
    (input) => Boolean(input.gratitude || input.did_well || input.improve_tomorrow),
    'Fill at least gratitude, did_well or improve_tomorrow.',
  );

  return [
    {
      type: 'journal.list',
      kind: 'read',
      requiresSetting: 'journal_access_enabled',
      description: "Read the user's journal entries of the last N days (default 14): gratitude, what went well, what to improve, habits. Private data: use it carefully and only when it helps the conversation.",
      inputSchema: listSchema,
      jsonSchema: {
        type: 'object',
        additionalProperties: false,
        properties: { days: { type: 'integer', minimum: 1, maximum: 60 } },
      },
      summarize: () => 'Journal lesen',
      async execute(userId, input: z.infer<typeof listSchema>) {
        const since = localDateKey(context.now(), context.timeZone, -(input.days - 1));
        const result = await db().query<{
          entry_date: string; gratitude: string | null; did_well: string | null; improve_tomorrow: string | null;
          habits_completed: boolean | null; missed_habits: string | null; created_at: Date | string;
        }>(
          `select to_char(entry_date, 'YYYY-MM-DD') as entry_date, gratitude, did_well, improve_tomorrow,
                  habits_completed, missed_habits, created_at
           from public.journal_entries
           where user_id = $1 and entry_date >= $2::date
           order by entry_date desc, created_at desc
           limit 60`,
          [userId, since],
        );
        return {
          data: {
            entries: result.rows.map((entry) => ({
              date: entry.entry_date,
              gratitude: clip(entry.gratitude),
              did_well: clip(entry.did_well),
              improve_tomorrow: clip(entry.improve_tomorrow),
              habits_completed: entry.habits_completed,
              missed_habits: clip(entry.missed_habits),
              created_at: iso(entry.created_at),
            })),
          },
        };
      },
    },
    {
      type: 'journal_entry.create',
      kind: 'write',
      requiresSetting: 'journal_access_enabled',
      description: "Propose a journal entry for today or yesterday, e.g. when the user asks you to turn the conversation into their journal. Use the user's own words; never invent feelings. Only if there is no entry for that day yet.",
      inputSchema: createSchema,
      jsonSchema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          day: { type: 'string', enum: ['today', 'yesterday'] },
          gratitude: { type: 'string', maxLength: FIELD_MAX, description: 'Wofür bin ich dankbar?' },
          did_well: { type: 'string', maxLength: FIELD_MAX, description: 'Was habe ich gut gemacht?' },
          improve_tomorrow: { type: 'string', maxLength: FIELD_MAX, description: 'Was mache ich morgen besser?' },
          habits_completed: { type: 'boolean', description: 'Were all habits done?' },
          missed_habits: { type: 'string', maxLength: FIELD_MAX, description: 'Only if habits_completed is false.' },
        },
      },
      summarize(input: z.infer<typeof createSchema>) {
        const date = localDateKey(context.now(), context.timeZone, input.day === 'yesterday' ? -1 : 0);
        const parts = [
          input.gratitude ? 'Dankbarkeit' : null,
          input.did_well ? 'was gut lief' : null,
          input.improve_tomorrow ? 'was besser wird' : null,
        ].filter(Boolean);
        return `Journal-Eintrag für ${formatGermanDate(date)} anlegen (${parts.join(', ')})`;
      },
      async execute(userId, input: z.infer<typeof createSchema>) {
        const date = localDateKey(context.now(), context.timeZone, input.day === 'yesterday' ? -1 : 0);
        const existing = await db().query(
          'select 1 from public.journal_entries where user_id = $1 and entry_date = $2::date limit 1',
          [userId, date],
        );
        if (existing.rowCount) {
          throw new AppError(409, 'MENTOR_ACTION_CONFLICT', 'There is already a journal entry for this day.');
        }
        const habitsCompleted = input.habits_completed ?? null;
        const created = await db().query<{ id: string }>(
          `insert into public.journal_entries
             (user_id, entry_date, gratitude, did_well, improve_tomorrow, habits_completed, missed_habits)
           values ($1, $2::date, $3, $4, $5, $6, $7)
           returning id`,
          [
            userId,
            date,
            input.gratitude ?? null,
            input.did_well ?? null,
            input.improve_tomorrow ?? null,
            habitsCompleted,
            habitsCompleted === true ? null : input.missed_habits ?? null,
          ],
        );
        return { resultRef: { journal_entry_id: created.rows[0].id, entry_date: date } };
      },
    },
  ];
}
