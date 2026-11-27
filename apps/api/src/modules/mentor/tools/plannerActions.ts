import { z } from 'zod';
import { AppError } from '../../../errors/appError.js';
import type { MentorActionContext, MentorActionDefinition } from '../actions/mentorActionRegistry.js';
import { formatGermanDate, localDateKey, targetNotFound, textSchema, type Queryable } from './toolShared.js';

const TITLE_MAX = 100;
const DEFAULT_COLOR = '#D4AF37';
const ALL_DAY_START = '00:00';
const ALL_DAY_END = '23:59';

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.').refine((value) => {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}, 'Invalid date.');

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM (24h).');

type EventRow = {
  id: string;
  title: string;
  date: string;
  end_date: string | null;
  start_time: string;
  end_time: string;
};

function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function hhmm(value: string): string {
  return String(value).slice(0, 5);
}

function isAllDay(start: string, end: string): boolean {
  return hhmm(start) === ALL_DAY_START && hhmm(end) === ALL_DAY_END;
}

function describeWhen(event: { date: string; end_date: string | null; start_time: string; end_time: string }): string {
  const days = event.end_date && event.end_date !== event.date
    ? `${formatGermanDate(event.date)} – ${formatGermanDate(event.end_date)}`
    : formatGermanDate(event.date);
  return isAllDay(event.start_time, event.end_time)
    ? `${days}, ganztägig`
    : `${days}, ${hhmm(event.start_time)}–${hhmm(event.end_time)}`;
}

/** Keeps proposals within a sensible window around today. */
function assertDateWindow(date: string, today: string) {
  if (date < addDays(today, -365) || date > addDays(today, 3 * 365)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Date is too far in the past or future.');
  }
}

function resolveTimes(input: { all_day?: boolean; start_time?: string; end_time?: string }) {
  if (input.all_day) return { start: ALL_DAY_START, end: ALL_DAY_END };
  if (!input.start_time || !input.end_time) {
    throw new AppError(400, 'VALIDATION_ERROR', 'start_time and end_time are required unless all_day is true.');
  }
  return { start: input.start_time, end: input.end_time };
}

function assertConsistent(event: { date: string; end_date: string | null; start: string; end: string }) {
  if (event.end_date && event.end_date < event.date) {
    throw new AppError(400, 'VALIDATION_ERROR', 'end_date must not be before date.');
  }
  if (!event.end_date && event.end <= event.start) {
    throw new AppError(400, 'VALIDATION_ERROR', 'end_time must be after start_time.');
  }
}

async function requireEvent(db: Queryable, userId: string, eventId: string): Promise<EventRow> {
  const result = await db.query<EventRow>(
    `select id, title, to_char(date, 'YYYY-MM-DD') as date, to_char(end_date, 'YYYY-MM-DD') as end_date,
            start_time::text as start_time, end_time::text as end_time
     from public.daily_planner_events where id = $1 and user_id = $2`,
    [eventId, userId],
  );
  if (!result.rows[0]) throw targetNotFound('Planner event');
  return result.rows[0];
}

export function createPlannerActions(db: () => Queryable, context: MentorActionContext): MentorActionDefinition[] {
  const listSchema = z.object({
    from_date: dateSchema.optional(),
    days: z.number().int().min(1).max(14).default(7),
  }).strict();

  const createSchema = z.object({
    title: textSchema(TITLE_MAX),
    date: dateSchema,
    end_date: dateSchema.optional(),
    all_day: z.boolean().optional(),
    start_time: timeSchema.optional(),
    end_time: timeSchema.optional(),
  }).strict();

  const updateSchema = z.object({
    event_id: z.string().uuid(),
    title: textSchema(TITLE_MAX).optional(),
    date: dateSchema.optional(),
    all_day: z.boolean().optional(),
    start_time: timeSchema.optional(),
    end_time: timeSchema.optional(),
  }).strict().refine(
    (input) => Object.keys(input).some((key) => key !== 'event_id'),
    'Change at least one field.',
  );

  /** Applies an update to the stored event and validates the result. */
  function applyUpdate(event: EventRow, input: z.infer<typeof updateSchema>) {
    const today = localDateKey(context.now(), context.timeZone);
    const date = input.date ?? event.date;
    const span = event.end_date ? Math.round((Date.parse(event.end_date) - Date.parse(event.date)) / 86_400_000) : 0;
    const endDate = event.end_date ? addDays(date, span) : null;
    let start = hhmm(event.start_time);
    let end = hhmm(event.end_time);
    if (input.all_day === true) {
      start = ALL_DAY_START;
      end = ALL_DAY_END;
    } else if (input.all_day === false || input.start_time || input.end_time) {
      start = input.start_time ?? (isAllDay(start, end) ? '' : start);
      end = input.end_time ?? (isAllDay(start, end) ? '' : end);
      if (!start || !end) {
        throw new AppError(400, 'VALIDATION_ERROR', 'start_time and end_time are required when the event is no longer all-day.');
      }
    }
    if (input.date) assertDateWindow(date, today);
    assertConsistent({ date, end_date: endDate, start, end });
    return { title: input.title ?? event.title, date, end_date: endDate, start_time: start, end_time: end };
  }

  return [
    {
      type: 'planner.list',
      kind: 'read',
      description: "Read the user's daily planner events for a date range (default: today and the next 6 days). Dates are YYYY-MM-DD in the user's time zone.",
      inputSchema: listSchema,
      jsonSchema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          from_date: { type: 'string', description: 'YYYY-MM-DD, default today' },
          days: { type: 'integer', minimum: 1, maximum: 14 },
        },
      },
      summarize: () => 'Termine lesen',
      async execute(userId, input: z.infer<typeof listSchema>) {
        const today = localDateKey(context.now(), context.timeZone);
        const from = input.from_date ?? today;
        const to = addDays(from, input.days - 1);
        const result = await db().query<EventRow>(
          `select id, title, to_char(date, 'YYYY-MM-DD') as date, to_char(end_date, 'YYYY-MM-DD') as end_date,
                  start_time::text as start_time, end_time::text as end_time
           from public.daily_planner_events
           where user_id = $1 and date <= $3::date and coalesce(end_date, date) >= $2::date
           order by date asc, start_time asc
           limit 100`,
          [userId, from, to],
        );
        return {
          data: {
            today,
            from,
            to,
            events: result.rows.map((event) => ({
              id: event.id,
              title: event.title,
              date: event.date,
              end_date: event.end_date,
              all_day: isAllDay(event.start_time, event.end_time),
              start_time: hhmm(event.start_time),
              end_time: hhmm(event.end_time),
            })),
          },
        };
      },
    },
    {
      type: 'planner_event.create',
      kind: 'write',
      description: 'Propose a daily planner event: title, date (YYYY-MM-DD), optional end_date for multi-day events, and either all_day=true or start_time and end_time (HH:MM, 24h). Check planner.list for conflicts first when it matters.',
      inputSchema: createSchema,
      jsonSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'date'],
        properties: {
          title: { type: 'string', maxLength: TITLE_MAX },
          date: { type: 'string', description: 'YYYY-MM-DD' },
          end_date: { type: 'string', description: 'YYYY-MM-DD, only for multi-day events' },
          all_day: { type: 'boolean' },
          start_time: { type: 'string', description: 'HH:MM' },
          end_time: { type: 'string', description: 'HH:MM' },
        },
      },
      summarize(input: z.infer<typeof createSchema>) {
        const today = localDateKey(context.now(), context.timeZone);
        const times = resolveTimes(input);
        const endDate = input.end_date && input.end_date !== input.date ? input.end_date : null;
        assertDateWindow(input.date, today);
        assertConsistent({ date: input.date, end_date: endDate, ...times });
        return `Termin „${input.title}“ eintragen (${describeWhen({
          date: input.date, end_date: endDate, start_time: times.start, end_time: times.end,
        })})`;
      },
      async execute(userId, input: z.infer<typeof createSchema>) {
        const times = resolveTimes(input);
        const endDate = input.end_date && input.end_date !== input.date ? input.end_date : null;
        assertConsistent({ date: input.date, end_date: endDate, ...times });
        const created = await db().query<{ id: string }>(
          `insert into public.daily_planner_events (user_id, date, end_date, start_time, end_time, title, color)
           values ($1, $2, $3, $4, $5, $6, $7) returning id`,
          [userId, input.date, endDate, times.start, times.end, input.title, DEFAULT_COLOR],
        );
        return { resultRef: { event_id: created.rows[0].id } };
      },
    },
    {
      type: 'planner_event.update',
      kind: 'write',
      description: 'Propose changing a planner event: title, date (multi-day events keep their length), all_day, or start_time/end_time. Use planner.list first.',
      inputSchema: updateSchema,
      jsonSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['event_id'],
        properties: {
          event_id: { type: 'string', description: 'id from planner.list' },
          title: { type: 'string', maxLength: TITLE_MAX },
          date: { type: 'string', description: 'YYYY-MM-DD' },
          all_day: { type: 'boolean' },
          start_time: { type: 'string', description: 'HH:MM' },
          end_time: { type: 'string', description: 'HH:MM' },
        },
      },
      async summarize(input: z.infer<typeof updateSchema>, userId) {
        const event = await requireEvent(db(), userId, input.event_id);
        const next = applyUpdate(event, input);
        const title = next.title !== event.title ? ` → „${next.title}“` : '';
        return `Termin „${event.title}“${title} ändern: ${describeWhen(next)}`;
      },
      async execute(userId, input: z.infer<typeof updateSchema>) {
        const event = await requireEvent(db(), userId, input.event_id);
        const next = applyUpdate(event, input);
        const updated = await db().query(
          `update public.daily_planner_events
           set title = $3, date = $4, end_date = $5, start_time = $6, end_time = $7
           where id = $1 and user_id = $2 returning id`,
          [input.event_id, userId, next.title, next.date, next.end_date, next.start_time, next.end_time],
        );
        if (!updated.rowCount) throw targetNotFound('Planner event');
        return { resultRef: { event_id: input.event_id } };
      },
    },
  ];
}
