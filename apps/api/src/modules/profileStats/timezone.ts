export type LocalDate = { year: number; month: number; day: number };

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let value = formatterCache.get(timeZone);
  if (!value) {
    value = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hourCycle: 'h23',
    });
    formatterCache.set(timeZone, value);
  }
  return value;
}

export function localParts(instant: Date, timeZone: string): LocalDate & {
  hour: number; minute: number; second: number;
} {
  const parts = Object.fromEntries(
    formatter(timeZone).formatToParts(instant)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  );
  return parts as LocalDate & { hour: number; minute: number; second: number };
}

export function dateKey(date: LocalDate): string {
  return `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
}

export function addLocalDays(date: LocalDate, days: number): LocalDate {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + days, 12));
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() };
}

export function localDayOfWeek(date: LocalDate): number {
  const sundayBased = new Date(Date.UTC(date.year, date.month - 1, date.day, 12)).getUTCDay();
  return sundayBased === 0 ? 6 : sundayBased - 1;
}

export function localDateTimeToUtc(date: LocalDate, timeZone: string): Date {
  const desired = Date.UTC(date.year, date.month - 1, date.day, 0, 0, 0);
  let candidate = desired;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const actual = localParts(new Date(candidate), timeZone);
    const represented = Date.UTC(
      actual.year, actual.month - 1, actual.day,
      actual.hour, actual.minute, actual.second,
    );
    const adjustment = desired - represented;
    candidate += adjustment;
    if (adjustment === 0) break;
  }
  return new Date(candidate);
}

export function getCalendarBounds(now: Date, timeZone: string) {
  const today = localParts(now, timeZone);
  const localToday: LocalDate = { year: today.year, month: today.month, day: today.day };
  const tomorrow = addLocalDays(localToday, 1);
  const monday = addLocalDays(localToday, -localDayOfWeek(localToday));
  const nextMonday = addLocalDays(monday, 7);
  return {
    today: localToday,
    todayKey: dateKey(localToday),
    earliestStreakKey: dateKey(addLocalDays(localToday, -89)),
    todayStartUtc: localDateTimeToUtc(localToday, timeZone),
    tomorrowStartUtc: localDateTimeToUtc(tomorrow, timeZone),
    weekStartKey: dateKey(monday),
    weekEndExclusiveKey: dateKey(nextMonday),
  };
}
