import { z } from 'zod';
import { AppError } from '../../../errors/appError.js';
import type { MentorActionContext, MentorActionDefinition } from '../actions/mentorActionRegistry.js';
import {
  formatGermanDate,
  formatWeekdays,
  iso,
  localDateKey,
  targetNotFound,
  textSchema,
  weekdaysJsonSchema,
  weekdaysSchema,
  weekdaysToNumbers,
  type Queryable,
} from './toolShared.js';
import { localDayOfWeek } from '../../profileStats/timezone.js';

const HABIT_NAME_MAX = 60;
const STATS_WINDOW_DAYS = 28;

type HabitRow = { id: string; name: string; days: number[]; linked_tool_title: string | null; created_at: Date | string };

async function findHabit(db: Queryable, userId: string, habitId: string) {
  const result = await db.query<{ id: string; name: string; days: number[] }>(
    'select id, name, days from public.habits where id = $1 and user_id = $2',
    [habitId, userId],
  );
  return result.rows[0] ?? null;
}

async function requireHabit(db: Queryable, userId: string, habitId: string) {
  const habit = await findHabit(db, userId, habitId);
  if (!habit) throw targetNotFound('Habit');
  return habit;
}

function scheduledCount(days: number[], todayKey: string, windowDays: number): number {
  const [year, month, day] = todayKey.split('-').map(Number);
  let count = 0;
  for (let offset = 0; offset < windowDays; offset += 1) {
    const date = new Date(Date.UTC(year, month - 1, day - offset, 12));
    const weekday = localDayOfWeek({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() });
    if (days.includes(weekday)) count += 1;
  }
  return count;
}

export function createHabitActions(db: () => Queryable, context: MentorActionContext): MentorActionDefinition[] {
  const listSchema = z.object({}).strict();

  const createSchema = z.object({
    name: textSchema(HABIT_NAME_MAX),
    days: weekdaysSchema,
  }).strict();

  const updateSchema = z.object({
    habit_id: z.string().uuid(),
    name: textSchema(HABIT_NAME_MAX).optional(),
    days: weekdaysSchema.optional(),
  }).strict().refine((input) => input.name !== undefined || input.days !== undefined, 'Change name or days.');

  const completeSchema = z.object({
    habit_id: z.string().uuid(),
    day: z.enum(['today', 'yesterday']).default('today'),
  }).strict();

  return [
    {
      type: 'habits.list',
      kind: 'read',
      description: `Read the user's habits with their weekdays, whether each is done today and how often it was done in the last ${STATS_WINDOW_DAYS} days.`,
      inputSchema: listSchema,
      jsonSchema: { type: 'object', properties: {}, additionalProperties: false },
      summarize: () => 'Gewohnheiten lesen',
      async execute(userId) {
        const now = context.now();
        const today = localDateKey(now, context.timeZone);
        const since = localDateKey(now, context.timeZone, -(STATS_WINDOW_DAYS - 1));
        const habits = await db().query<HabitRow>(
          `select id, name, days, linked_tool_title, created_at from public.habits
           where user_id = $1 order by created_at asc limit 100`,
          [userId],
        );
        const completions = await db().query<{ habit_id: string; total: number; done_today: boolean }>(
          `select habit_id, count(*)::int as total, bool_or(completed_date = $3::date) as done_today
           from public.habit_completions
           where user_id = $1 and completed_date between $2::date and $3::date
           group by habit_id`,
          [userId, since, today],
        );
        const byHabit = new Map(completions.rows.map((row) => [row.habit_id, row]));
        return {
          data: {
            today,
            window_days: STATS_WINDOW_DAYS,
            habits: habits.rows.map((habit) => ({
              id: habit.id,
              name: habit.name,
              days: formatWeekdays(habit.days),
              linked_tool: habit.linked_tool_title,
              done_today: byHabit.get(habit.id)?.done_today ?? false,
              completed_in_window: byHabit.get(habit.id)?.total ?? 0,
              scheduled_in_window: scheduledCount(habit.days, today, STATS_WINDOW_DAYS),
              created_at: iso(habit.created_at),
            })),
          },
        };
      },
    },
    {
      type: 'habit.create',
      kind: 'write',
      description: 'Propose a new habit with a short name and the weekdays it is scheduled on.',
      inputSchema: createSchema,
      jsonSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'days'],
        properties: {
          name: { type: 'string', maxLength: HABIT_NAME_MAX, description: 'Short habit name, e.g. "10 Seiten lesen".' },
          days: weekdaysJsonSchema,
        },
      },
      summarize: (input: z.infer<typeof createSchema>) =>
        `Gewohnheit „${input.name}“ anlegen (${formatWeekdays(weekdaysToNumbers(input.days))})`,
      async execute(userId, input: z.infer<typeof createSchema>) {
        const duplicate = await db().query(
          'select 1 from public.habits where user_id = $1 and lower(name) = lower($2) limit 1',
          [userId, input.name],
        );
        if (duplicate.rowCount) {
          throw new AppError(409, 'MENTOR_ACTION_CONFLICT', 'A habit with this name already exists.');
        }
        const created = await db().query<{ id: string }>(
          'insert into public.habits (user_id, name, days) values ($1, $2, $3) returning id',
          [userId, input.name, weekdaysToNumbers(input.days)],
        );
        return { resultRef: { habit_id: created.rows[0].id } };
      },
    },
    {
      type: 'habit.update',
      kind: 'write',
      description: 'Propose renaming a habit or changing its weekdays. Use habits.list first to get the habit_id. If the habit belongs to a habit collection, the collection keeps controlling its weekdays.',
      inputSchema: updateSchema,
      jsonSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['habit_id'],
        properties: {
          habit_id: { type: 'string', description: 'id from habits.list' },
          name: { type: 'string', maxLength: HABIT_NAME_MAX },
          days: weekdaysJsonSchema,
        },
      },
      async summarize(input: z.infer<typeof updateSchema>, userId) {
        const habit = await requireHabit(db(), userId, input.habit_id);
        const changes = [
          input.name ? `neuer Name „${input.name}“` : null,
          input.days ? `Tage ${formatWeekdays(weekdaysToNumbers(input.days))}` : null,
        ].filter(Boolean);
        return `Gewohnheit „${habit.name}“ ändern: ${changes.join(', ')}`;
      },
      async execute(userId, input: z.infer<typeof updateSchema>) {
        const updated = await db().query<{ id: string }>(
          `update public.habits
           set name = coalesce($3, name), days = coalesce($4::integer[], days)
           where id = $1 and user_id = $2
           returning id`,
          [input.habit_id, userId, input.name ?? null, input.days ? weekdaysToNumbers(input.days) : null],
        );
        if (!updated.rowCount) throw targetNotFound('Habit');
        return { resultRef: { habit_id: input.habit_id } };
      },
    },
    {
      type: 'habit.complete',
      kind: 'write',
      description: 'Propose marking a habit as done for today or yesterday, e.g. when the user says they did it.',
      inputSchema: completeSchema,
      jsonSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['habit_id'],
        properties: {
          habit_id: { type: 'string', description: 'id from habits.list' },
          day: { type: 'string', enum: ['today', 'yesterday'] },
        },
      },
      async summarize(input: z.infer<typeof completeSchema>, userId) {
        const habit = await requireHabit(db(), userId, input.habit_id);
        const date = localDateKey(context.now(), context.timeZone, input.day === 'yesterday' ? -1 : 0);
        return `„${habit.name}“ für ${input.day === 'yesterday' ? 'gestern' : 'heute'} (${formatGermanDate(date)}) abhaken`;
      },
      async execute(userId, input: z.infer<typeof completeSchema>) {
        await requireHabit(db(), userId, input.habit_id);
        const date = localDateKey(context.now(), context.timeZone, input.day === 'yesterday' ? -1 : 0);
        await db().query(
          `insert into public.habit_completions (habit_id, user_id, completed_date)
           select $1, $2, $3::date
           where not exists (
             select 1 from public.habit_completions
             where habit_id = $1 and user_id = $2 and completed_date = $3::date
           )`,
          [input.habit_id, userId, date],
        );
        return { resultRef: { habit_id: input.habit_id, completed_date: date } };
      },
    },
  ];
}
