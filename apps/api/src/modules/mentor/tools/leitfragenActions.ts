import { z } from 'zod';
import type { MentorActionContext, MentorActionDefinition } from '../actions/mentorActionRegistry.js';
import { iso, type Queryable } from './toolShared.js';

const ANSWER_MAX = 4000;
const READ_ANSWER_MAX = 2000;

/** Question keys and titles as in the Leitfragen tool of the app. */
export const LEITFRAGEN = {
  dream_life: 'Wie würde dein absolutes Traumleben aussehen?',
  best_life_moments: 'Was waren bisher die schönsten Momente deines Lebens?',
  deepest_gratitude: 'Wofür bist du in deinem Leben am dankbarsten?',
  proudest_achievements: 'Worauf bist du in deinem Leben bisher am meisten stolz?',
  biggest_strengths: 'Was sind deine größten Stärken?',
  where_one_month: 'Wo sehe ich mich in 1 Monat?',
  where_one_year: 'Wo sehe ich mich in 1 Jahr?',
  where_three_years: 'Wo sehe ich mich in 3 Jahren?',
  where_ten_years: 'Wo sehe ich mich in 10 Jahren?',
} as const;

type LeitfrageKey = keyof typeof LEITFRAGEN;
const KEYS = Object.keys(LEITFRAGEN) as [LeitfrageKey, ...LeitfrageKey[]];

export function createLeitfragenActions(db: () => Queryable, _context: MentorActionContext): MentorActionDefinition[] {
  const answerSchema = z.object({
    question_key: z.enum(KEYS),
    answer: z
      .string()
      .transform((value) => value.normalize('NFC').trim())
      .pipe(z.string().min(1).max(ANSWER_MAX)),
  }).strict();

  return [
    {
      type: 'leitfragen.list',
      kind: 'read',
      description: "Read the user's answers to Grow's guiding questions (dream life, strengths, gratitude, where they see themselves in 1 month / 1 / 3 / 10 years). Very useful for goals and long-term coaching.",
      inputSchema: z.object({}).strict(),
      jsonSchema: { type: 'object', properties: {}, additionalProperties: false },
      summarize: () => 'Leitfragen lesen',
      async execute(userId) {
        const result = await db().query<{ question_key: string; answer: string | null; updated_at: Date | string | null }>(
          'select question_key, answer, updated_at from public.leitfragen_answers where user_id = $1',
          [userId],
        );
        const answers = new Map(result.rows.map((row) => [row.question_key, row]));
        return {
          data: {
            questions: KEYS.map((key) => {
              const row = answers.get(key);
              const answer = row?.answer?.trim() || null;
              return {
                key,
                question: LEITFRAGEN[key],
                answer: answer && answer.length > READ_ANSWER_MAX ? `${answer.slice(0, READ_ANSWER_MAX)}…` : answer,
                updated_at: iso(row?.updated_at ?? null),
              };
            }),
          },
        };
      },
    },
    {
      type: 'leitfrage.answer',
      kind: 'write',
      description: "Propose saving the user's answer to one guiding question, e.g. after working it out together. Use the user's own words. Replaces an existing answer, so check leitfragen.list first and build on it.",
      inputSchema: answerSchema,
      jsonSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['question_key', 'answer'],
        properties: {
          question_key: { type: 'string', enum: KEYS },
          answer: { type: 'string', maxLength: ANSWER_MAX },
        },
      },
      async summarize(input: z.infer<typeof answerSchema>, userId) {
        const existing = await db().query<{ answer: string | null }>(
          'select answer from public.leitfragen_answers where user_id = $1 and question_key = $2',
          [userId, input.question_key],
        );
        const replaces = Boolean(existing.rows[0]?.answer?.trim());
        return `Leitfrage „${LEITFRAGEN[input.question_key]}“ ${replaces ? 'neu beantworten (ersetzt deine bisherige Antwort)' : 'beantworten'}`;
      },
      async execute(userId, input: z.infer<typeof answerSchema>) {
        await db().query(
          `insert into public.leitfragen_answers (user_id, question_key, answer, updated_at)
           values ($1, $2, $3, now())
           on conflict (user_id, question_key) do update set answer = excluded.answer, updated_at = now()`,
          [userId, input.question_key, input.answer],
        );
        return { resultRef: { question_key: input.question_key } };
      },
    },
  ];
}
