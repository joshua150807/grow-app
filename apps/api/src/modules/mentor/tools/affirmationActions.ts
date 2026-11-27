import { z } from 'zod';
import type { MentorActionContext, MentorActionDefinition } from '../actions/mentorActionRegistry.js';
import { iso, targetNotFound, textSchema, type Queryable } from './toolShared.js';

/** Same limits and categories as the affirmations tool in the app. */
const TEXT_MAX = 160;
const CATEGORIES = ['Disziplin', 'Fokus', 'Selbstvertrauen', 'Erfolg', 'Körper', 'Ruhe'] as const;

async function requireAffirmation(db: Queryable, userId: string, id: string) {
  const result = await db.query<{ id: string; text: string }>(
    'select id, text from public.affirmations where id = $1 and user_id = $2',
    [id, userId],
  );
  if (!result.rows[0]) throw targetNotFound('Affirmation');
  return result.rows[0];
}

export function createAffirmationActions(db: () => Queryable, _context: MentorActionContext): MentorActionDefinition[] {
  const createSchema = z.object({
    text: textSchema(TEXT_MAX),
    category: z.enum(CATEGORIES),
  }).strict();

  const updateSchema = z.object({
    affirmation_id: z.string().uuid(),
    text: textSchema(TEXT_MAX).optional(),
    category: z.enum(CATEGORIES).optional(),
  }).strict().refine((input) => input.text !== undefined || input.category !== undefined, 'Change text or category.');

  return [
    {
      type: 'affirmations.list',
      kind: 'read',
      description: "Read the user's affirmations with category, when they were last repeated and how often.",
      inputSchema: z.object({}).strict(),
      jsonSchema: { type: 'object', properties: {}, additionalProperties: false },
      summarize: () => 'Affirmationen lesen',
      async execute(userId) {
        const result = await db().query<{
          id: string; text: string; category: string | null; last_repeated_date: string | null;
          total_repetitions: number | null; created_at: Date | string;
        }>(
          `select id, text, category, last_repeated_date::text as last_repeated_date, total_repetitions, created_at
           from public.affirmations where user_id = $1 order by created_at desc limit 100`,
          [userId],
        );
        return {
          data: {
            affirmations: result.rows.map((row) => ({
              id: row.id,
              text: row.text,
              category: row.category,
              last_repeated_date: row.last_repeated_date,
              total_repetitions: row.total_repetitions ?? 0,
              created_at: iso(row.created_at),
            })),
          },
        };
      },
    },
    {
      type: 'affirmation.create',
      kind: 'write',
      description: `Propose a personal affirmation in first person, present tense, positive, max ${TEXT_MAX} characters. Categories: ${CATEGORIES.join(', ')}.`,
      inputSchema: createSchema,
      jsonSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['text', 'category'],
        properties: {
          text: { type: 'string', maxLength: TEXT_MAX },
          category: { type: 'string', enum: [...CATEGORIES] },
        },
      },
      summarize: (input: z.infer<typeof createSchema>) => `Affirmation „${input.text}“ (${input.category}) anlegen`,
      async execute(userId, input: z.infer<typeof createSchema>) {
        const created = await db().query<{ id: string }>(
          'insert into public.affirmations (user_id, text, category) values ($1, $2, $3) returning id',
          [userId, input.text, input.category],
        );
        return { resultRef: { affirmation_id: created.rows[0].id } };
      },
    },
    {
      type: 'affirmation.update',
      kind: 'write',
      description: 'Propose rewording an affirmation or changing its category. Use affirmations.list first.',
      inputSchema: updateSchema,
      jsonSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['affirmation_id'],
        properties: {
          affirmation_id: { type: 'string', description: 'id from affirmations.list' },
          text: { type: 'string', maxLength: TEXT_MAX },
          category: { type: 'string', enum: [...CATEGORIES] },
        },
      },
      async summarize(input: z.infer<typeof updateSchema>, userId) {
        const current = await requireAffirmation(db(), userId, input.affirmation_id);
        const changes = [
          input.text ? `neuer Text „${input.text}“` : null,
          input.category ? `Kategorie ${input.category}` : null,
        ].filter(Boolean);
        return `Affirmation „${current.text}“ ändern: ${changes.join(', ')}`;
      },
      async execute(userId, input: z.infer<typeof updateSchema>) {
        const updated = await db().query(
          `update public.affirmations
           set text = coalesce($3, text), category = coalesce($4, category), updated_at = now()
           where id = $1 and user_id = $2 returning id`,
          [input.affirmation_id, userId, input.text ?? null, input.category ?? null],
        );
        if (!updated.rowCount) throw targetNotFound('Affirmation');
        return { resultRef: { affirmation_id: input.affirmation_id } };
      },
    },
  ];
}
