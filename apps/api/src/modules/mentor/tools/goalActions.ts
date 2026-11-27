import { z } from 'zod';
import type { MentorActionContext, MentorActionDefinition } from '../actions/mentorActionRegistry.js';
import { iso, targetNotFound, textSchema, type Queryable } from './toolShared.js';

const GOAL_NAME_MAX = 120;
const CATEGORIES = ['monthly', 'yearly', 'lifetime'] as const;
const CATEGORY_LABELS: Record<(typeof CATEGORIES)[number], string> = {
  monthly: 'Monatsziel',
  yearly: 'Jahresziel',
  lifetime: 'Lebensziel',
};

/** Grow stores goal deadlines as text in the app's format, e.g. "31.12.2026". */
const deadlineSchema = z
  .string()
  .regex(/^\d{2}\.\d{2}\.\d{4}$/, 'Use DD.MM.YYYY.')
  .refine((value) => {
    const [day, month, year] = value.split('.').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return year >= 2000 && year <= 2150
      && date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }, 'Invalid date.');

async function requireGoal(db: Queryable, userId: string, goalId: string) {
  const result = await db.query<{ id: string; name: string; completed: boolean | null }>(
    'select id, name, completed from public.goals where id = $1 and user_id = $2',
    [goalId, userId],
  );
  if (!result.rows[0]) throw targetNotFound('Goal');
  return result.rows[0];
}

export function createGoalActions(db: () => Queryable, _context: MentorActionContext): MentorActionDefinition[] {
  const createSchema = z.object({
    name: textSchema(GOAL_NAME_MAX),
    category: z.enum(CATEGORIES),
    deadline: deadlineSchema.optional(),
  }).strict();

  const updateSchema = z.object({
    goal_id: z.string().uuid(),
    name: textSchema(GOAL_NAME_MAX).optional(),
    deadline: deadlineSchema.nullable().optional(),
  }).strict().refine((input) => input.name !== undefined || input.deadline !== undefined, 'Change name or deadline.');

  const completeSchema = z.object({ goal_id: z.string().uuid() }).strict();

  return [
    {
      type: 'goals.list',
      kind: 'read',
      description: "Read the user's goals (monthly, yearly, lifetime) with deadline and whether they are reached.",
      inputSchema: z.object({}).strict(),
      jsonSchema: { type: 'object', properties: {}, additionalProperties: false },
      summarize: () => 'Ziele lesen',
      async execute(userId) {
        const result = await db().query<{
          id: string; name: string; category: string | null; deadline: string | null;
          completed: boolean | null; completed_at: Date | string | null; created_at: Date | string;
        }>(
          `select id, name, category, deadline, completed, completed_at, created_at from public.goals
           where user_id = $1 order by coalesce(completed, false) asc, created_at asc limit 100`,
          [userId],
        );
        return {
          data: {
            goals: result.rows.map((goal) => ({
              id: goal.id,
              name: goal.name,
              category: goal.category,
              deadline: goal.deadline,
              completed: goal.completed === true,
              completed_at: iso(goal.completed_at),
              created_at: iso(goal.created_at),
            })),
          },
        };
      },
    },
    {
      type: 'goal.create',
      kind: 'write',
      description: 'Propose a new goal. category: monthly (this month), yearly (this year) or lifetime. Optional deadline as DD.MM.YYYY. Make goals concrete and measurable together with the user.',
      inputSchema: createSchema,
      jsonSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'category'],
        properties: {
          name: { type: 'string', maxLength: GOAL_NAME_MAX },
          category: { type: 'string', enum: [...CATEGORIES] },
          deadline: { type: 'string', description: 'DD.MM.YYYY, e.g. 31.12.2026' },
        },
      },
      summarize: (input: z.infer<typeof createSchema>) =>
        `${CATEGORY_LABELS[input.category]} „${input.name}“ anlegen${input.deadline ? ` (bis ${input.deadline})` : ''}`,
      async execute(userId, input: z.infer<typeof createSchema>) {
        const created = await db().query<{ id: string }>(
          'insert into public.goals (user_id, name, category, deadline) values ($1, $2, $3, $4) returning id',
          [userId, input.name, input.category, input.deadline ?? null],
        );
        return { resultRef: { goal_id: created.rows[0].id } };
      },
    },
    {
      type: 'goal.update',
      kind: 'write',
      description: 'Propose renaming a goal or changing its deadline (null removes it). Use goals.list first.',
      inputSchema: updateSchema,
      jsonSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['goal_id'],
        properties: {
          goal_id: { type: 'string', description: 'id from goals.list' },
          name: { type: 'string', maxLength: GOAL_NAME_MAX },
          deadline: { type: ['string', 'null'], description: 'DD.MM.YYYY or null' },
        },
      },
      async summarize(input: z.infer<typeof updateSchema>, userId) {
        const goal = await requireGoal(db(), userId, input.goal_id);
        const changes = [
          input.name ? `neuer Name „${input.name}“` : null,
          input.deadline === null ? 'ohne Deadline' : null,
          input.deadline ? `Deadline ${input.deadline}` : null,
        ].filter(Boolean);
        return `Ziel „${goal.name}“ ändern: ${changes.join(', ')}`;
      },
      async execute(userId, input: z.infer<typeof updateSchema>) {
        const updated = await db().query(
          `update public.goals
           set name = coalesce($3, name),
               deadline = case when $4::boolean then $5 else deadline end
           where id = $1 and user_id = $2
           returning id`,
          [input.goal_id, userId, input.name ?? null, input.deadline !== undefined, input.deadline ?? null],
        );
        if (!updated.rowCount) throw targetNotFound('Goal');
        return { resultRef: { goal_id: input.goal_id } };
      },
    },
    {
      type: 'goal.complete',
      kind: 'write',
      description: 'Propose marking a goal as reached. Use goals.list first.',
      inputSchema: completeSchema,
      jsonSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['goal_id'],
        properties: { goal_id: { type: 'string', description: 'id from goals.list' } },
      },
      async summarize(input: z.infer<typeof completeSchema>, userId) {
        const goal = await requireGoal(db(), userId, input.goal_id);
        return `Ziel „${goal.name}“ als erreicht markieren`;
      },
      async execute(userId, input: z.infer<typeof completeSchema>) {
        const updated = await db().query(
          `update public.goals set completed = true, completed_at = coalesce(completed_at, now())
           where id = $1 and user_id = $2 returning id`,
          [input.goal_id, userId],
        );
        if (!updated.rowCount) throw targetNotFound('Goal');
        return { resultRef: { goal_id: input.goal_id } };
      },
    },
  ];
}
