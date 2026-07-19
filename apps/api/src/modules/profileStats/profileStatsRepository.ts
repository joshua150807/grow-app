import type pg from 'pg';
import { getPgPool } from '../../db/client.js';

export type HabitRow = {
  id: string; days: unknown; archived_at: string | null; is_active: boolean | null; disabled: boolean | null;
};
export type CompletionRow = { habit_id: string; completed_date: string };
export type StatsSourceData = {
  habits: HabitRow[];
  completions: CompletionRow[];
  todosCompleted: number;
  todosTotal: number;
  todosCompletedAllTime: number;
  deepWorkSeconds: number;
  trainingSessions: number;
  goals: number;
  plannedDates: string[];
};

export type ProfileStatsRepository = {
  load(userId: string, bounds: {
    earliestStreakKey: string; todayKey: string; todayStartUtc: Date; tomorrowStartUtc: Date;
    weekStartKey: string; weekEndExclusiveKey: string;
  }): Promise<StatsSourceData>;
};

type Queryable = Pick<pg.Pool, 'query'>;

function integer(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function createProfileStatsRepository(db: Queryable = getPgPool()): ProfileStatsRepository {
  return {
    async load(userId, bounds) {
      const [habits, completions, todos, todosAllTime, deepWork, training, goals, planner] = await Promise.all([
        db.query<HabitRow>(
          `select id, days,
             to_jsonb(habits)->>'archived_at' as archived_at,
             (to_jsonb(habits)->>'is_active')::boolean as is_active,
             (to_jsonb(habits)->>'disabled')::boolean as disabled
           from public.habits where user_id = $1`,
          [userId],
        ),
        db.query<CompletionRow>(
          `select habit_id, completed_date::text from public.habit_completions
           where user_id = $1 and completed_date >= $2::date and completed_date <= $3::date`,
          [userId, bounds.earliestStreakKey, bounds.todayKey],
        ),
        db.query<{ completed: string; total: string }>(
          `select count(*) filter (where completed = true)::text as completed, count(*)::text as total
           from public.todos where user_id = $1 and due_at >= $2 and due_at < $3`,
          [userId, bounds.todayStartUtc, bounds.tomorrowStartUtc],
        ),
        db.query<{ total: string }>(
          `select count(*)::text as total from public.todo_completion_events
           where user_id = $1`,
          [userId],
        ),
        db.query<{ total: string }>(
          `select coalesce(sum(duration_seconds), 0)::text as total
           from public.deep_work_sessions where user_id = $1`,
          [userId],
        ),
        db.query<{ total: string }>(
          `select count(*)::text as total from public.training_sessions where user_id = $1`, [userId],
        ),
        db.query<{ total: string }>(
          `select count(*)::text as total from public.goals where user_id = $1`, [userId],
        ),
        db.query<{ date: string }>(
          `select distinct date::text as date from public.daily_planner_events
           where user_id = $1 and date >= $2::date and date < $3::date order by date`,
          [userId, bounds.weekStartKey, bounds.weekEndExclusiveKey],
        ),
      ]);
      return {
        habits: habits.rows,
        completions: completions.rows,
        todosCompleted: integer(todos.rows[0]?.completed),
        todosTotal: integer(todos.rows[0]?.total),
        todosCompletedAllTime: integer(todosAllTime.rows[0]?.total),
        deepWorkSeconds: integer(deepWork.rows[0]?.total),
        trainingSessions: integer(training.rows[0]?.total),
        goals: integer(goals.rows[0]?.total),
        plannedDates: planner.rows.map((row) => row.date),
      };
    },
  };
}
