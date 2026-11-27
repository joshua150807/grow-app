import { z } from 'zod';
import type { MentorActionContext, MentorActionDefinition } from '../actions/mentorActionRegistry.js';
import { formatGermanDateTime, iso, targetNotFound, textSchema, type Queryable } from './toolShared.js';

const TODO_TITLE_MAX = 200;
const LIST_LIMIT = 50;

const dueAtSchema = z
  .string()
  .datetime({ offset: true })
  .refine((value) => {
    const year = new Date(value).getUTCFullYear();
    return year >= 2000 && year <= 2100;
  }, 'Due date is out of range.');

async function requireTodo(db: Queryable, userId: string, todoId: string) {
  const result = await db.query<{ id: string; title: string; completed: boolean | null }>(
    'select id, title, completed from public.todos where id = $1 and user_id = $2',
    [todoId, userId],
  );
  if (!result.rows[0]) throw targetNotFound('Todo');
  return result.rows[0];
}

export function createTodoActions(db: () => Queryable, context: MentorActionContext): MentorActionDefinition[] {
  const createSchema = z.object({
    title: textSchema(TODO_TITLE_MAX),
    due_at: dueAtSchema.optional(),
  }).strict();

  const updateSchema = z.object({
    todo_id: z.string().uuid(),
    title: textSchema(TODO_TITLE_MAX).optional(),
    due_at: dueAtSchema.nullable().optional(),
  }).strict().refine((input) => input.title !== undefined || input.due_at !== undefined, 'Change title or due date.');

  const completeSchema = z.object({ todo_id: z.string().uuid() }).strict();

  const dueText = (dueAt: string | null | undefined) =>
    dueAt ? ` (fällig ${formatGermanDateTime(dueAt, context.timeZone)})` : '';

  return [
    {
      type: 'todos.list',
      kind: 'read',
      description: `Read the user's to-dos: open ones first (with due dates), then recently completed ones. Max ${LIST_LIMIT}.`,
      inputSchema: z.object({}).strict(),
      jsonSchema: { type: 'object', properties: {}, additionalProperties: false },
      summarize: () => 'To-dos lesen',
      async execute(userId) {
        const result = await db().query<{
          id: string; title: string; due_at: Date | string | null; completed: boolean | null; created_at: Date | string;
        }>(
          `select id, title, due_at, completed, created_at from public.todos
           where user_id = $1
           order by coalesce(completed, false) asc, due_at asc nulls last, created_at desc
           limit $2`,
          [userId, LIST_LIMIT],
        );
        return {
          data: {
            now: context.now().toISOString(),
            todos: result.rows.map((todo) => ({
              id: todo.id,
              title: todo.title,
              due_at: iso(todo.due_at),
              completed: todo.completed === true,
              created_at: iso(todo.created_at),
            })),
          },
        };
      },
    },
    {
      type: 'todo.create',
      kind: 'write',
      description: 'Propose a new to-do with an optional due date and time.',
      inputSchema: createSchema,
      jsonSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['title'],
        properties: {
          title: { type: 'string', maxLength: TODO_TITLE_MAX },
          due_at: { type: 'string', description: 'ISO 8601 date-time with UTC offset, e.g. 2026-11-28T18:00:00+01:00.' },
        },
      },
      summarize: (input: z.infer<typeof createSchema>) => `To-do „${input.title}“ anlegen${dueText(input.due_at)}`,
      async execute(userId, input: z.infer<typeof createSchema>) {
        const created = await db().query<{ id: string }>(
          'insert into public.todos (user_id, title, due_at, completed) values ($1, $2, $3, false) returning id',
          [userId, input.title, input.due_at ?? null],
        );
        return { resultRef: { todo_id: created.rows[0].id } };
      },
    },
    {
      type: 'todo.update',
      kind: 'write',
      description: 'Propose changing the title or due date of a to-do (due_at null removes the due date). Use todos.list first.',
      inputSchema: updateSchema,
      jsonSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['todo_id'],
        properties: {
          todo_id: { type: 'string', description: 'id from todos.list' },
          title: { type: 'string', maxLength: TODO_TITLE_MAX },
          due_at: { type: ['string', 'null'], description: 'ISO 8601 date-time with UTC offset, or null.' },
        },
      },
      async summarize(input: z.infer<typeof updateSchema>, userId) {
        const todo = await requireTodo(db(), userId, input.todo_id);
        const changes = [
          input.title ? `neuer Titel „${input.title}“` : null,
          input.due_at === null ? 'ohne Fälligkeit' : null,
          input.due_at ? `fällig ${formatGermanDateTime(input.due_at, context.timeZone)}` : null,
        ].filter(Boolean);
        return `To-do „${todo.title}“ ändern: ${changes.join(', ')}`;
      },
      async execute(userId, input: z.infer<typeof updateSchema>) {
        const updated = await db().query<{ id: string }>(
          `update public.todos
           set title = coalesce($3, title),
               due_at = case when $4::boolean then $5::timestamptz else due_at end
           where id = $1 and user_id = $2
           returning id`,
          [input.todo_id, userId, input.title ?? null, input.due_at !== undefined, input.due_at ?? null],
        );
        if (!updated.rowCount) throw targetNotFound('Todo');
        return { resultRef: { todo_id: input.todo_id } };
      },
    },
    {
      type: 'todo.complete',
      kind: 'write',
      description: 'Propose marking a to-do as done. Use todos.list first.',
      inputSchema: completeSchema,
      jsonSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['todo_id'],
        properties: { todo_id: { type: 'string', description: 'id from todos.list' } },
      },
      async summarize(input: z.infer<typeof completeSchema>, userId) {
        const todo = await requireTodo(db(), userId, input.todo_id);
        return `To-do „${todo.title}“ als erledigt markieren`;
      },
      async execute(userId, input: z.infer<typeof completeSchema>) {
        const updated = await db().query(
          'update public.todos set completed = true where id = $1 and user_id = $2 returning id',
          [input.todo_id, userId],
        );
        if (!updated.rowCount) throw targetNotFound('Todo');
        return { resultRef: { todo_id: input.todo_id } };
      },
    },
  ];
}
