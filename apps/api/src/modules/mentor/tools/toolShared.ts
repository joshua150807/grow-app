import type pg from 'pg';
import { z } from 'zod';
import { AppError } from '../../../errors/appError.js';
import { addLocalDays, dateKey, localParts, type LocalDate } from '../../profileStats/timezone.js';

export type Queryable = Pick<pg.Pool, 'query'>;

export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export const WEEKDAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const;

/** Model-facing weekday names; Grow stores Monday = 0 ... Sunday = 6. */
export const weekdaysSchema = z
  .array(z.enum(WEEKDAYS))
  .min(1)
  .max(7)
  .refine((days) => new Set(days).size === days.length, 'Days must be unique.');

export const weekdaysJsonSchema = {
  type: 'array',
  items: { type: 'string', enum: [...WEEKDAYS] },
  minItems: 1,
  maxItems: 7,
  uniqueItems: true,
  description: 'Weekdays. Use all seven for daily.',
} as const;

export function weekdaysToNumbers(days: readonly (typeof WEEKDAYS)[number][]): number[] {
  return [...new Set(days.map((day) => WEEKDAYS.indexOf(day)))].sort((a, b) => a - b);
}

export function formatWeekdays(days: number[]): string {
  const sorted = [...new Set(days)].filter((day) => day >= 0 && day <= 6).sort((a, b) => a - b);
  if (sorted.length === 7) return 'täglich';
  return sorted.map((day) => WEEKDAY_LABELS[day]).join(', ');
}

export function textSchema(max: number) {
  return z
    .string()
    .transform((value) => value.normalize('NFC').replace(/\s+/g, ' ').trim())
    .pipe(z.string().min(1).max(max));
}

export function localToday(now: Date, timeZone: string): LocalDate {
  const parts = localParts(now, timeZone);
  return { year: parts.year, month: parts.month, day: parts.day };
}

export function localDateKey(now: Date, timeZone: string, offsetDays = 0): string {
  return dateKey(addLocalDays(localToday(now, timeZone), offsetDays));
}

export function formatGermanDate(isoDate: string): string {
  const [year, month, day] = isoDate.slice(0, 10).split('-');
  return `${day}.${month}.${year}`;
}

export function formatGermanDateTime(value: Date | string, timeZone: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function targetNotFound(what: string): AppError {
  return new AppError(404, 'MENTOR_ACTION_TARGET_NOT_FOUND', `${what} was not found.`);
}

export function iso(value: Date | string | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
