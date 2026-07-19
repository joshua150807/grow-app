import type { AuthUser } from '../../auth/types.js';
import { addLocalDays, dateKey, getCalendarBounds, localDayOfWeek } from './timezone.js';
import { profileStatsQuerySchema } from './profileStatsSchemas.js';
import { createProfileStatsRepository, type CompletionRow, type HabitRow, type ProfileStatsRepository } from './profileStatsRepository.js';

function normalizedDays(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))];
}

export function calculateHabitStreak(habits: HabitRow[], completions: CompletionRow[], today: { year: number; month: number; day: number }): number {
  const active = habits.filter((habit) => habit.id && !habit.archived_at && habit.is_active !== false && habit.disabled !== true);
  const doneByDate = new Map<string, Set<string>>();
  for (const completion of completions) {
    if (!completion.habit_id || !completion.completed_date) continue;
    const done = doneByDate.get(completion.completed_date) ?? new Set<string>();
    done.add(completion.habit_id);
    doneByDate.set(completion.completed_date, done);
  }
  let streak = 0;
  for (let offset = 0; offset < 90; offset += 1) {
    const date = addLocalDays(today, -offset);
    const scheduled = active.filter((habit) => normalizedDays(habit.days).includes(localDayOfWeek(date)));
    if (scheduled.length === 0) continue;
    const done = doneByDate.get(dateKey(date)) ?? new Set<string>();
    const complete = scheduled.every((habit) => done.has(habit.id));
    if (offset === 0 && !complete) continue;
    if (!complete) break;
    streak += 1;
  }
  return streak;
}

export type ProfileStatsService = ReturnType<typeof createProfileStatsService>;

export function createProfileStatsService(repository: ProfileStatsRepository = createProfileStatsRepository(), now: () => Date = () => new Date()) {
  return {
    async get(user: AuthUser, query: unknown) {
      const { timezone } = profileStatsQuerySchema.parse(query);
      const bounds = getCalendarBounds(now(), timezone);
      const source = await repository.load(user.id, bounds);
      return {
        habit_streak: calculateHabitStreak(source.habits, source.completions, bounds.today),
        todos_today: { completed: source.todosCompleted, total: source.todosTotal },
        deep_work_seconds_all_time: source.deepWorkSeconds,
        training_sessions: source.trainingSessions,
        goals: source.goals,
        planned_days_current_week: Math.min(new Set(source.plannedDates).size, 7),
      };
    },
  };
}
