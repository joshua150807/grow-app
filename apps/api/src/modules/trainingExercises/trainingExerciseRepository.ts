import {
  trainingExerciseSchema,
  type CreateTrainingExerciseInput,
  type ListTrainingExercisesQuery,
  type TrainingExercise,
} from '@grow/shared';
import type pg from 'pg';
import { getPgPool } from '../../db/client.js';

type Queryable = Pick<pg.Pool, 'query'>;

export type TrainingExerciseRow = {
  id: string;
  system_key: string | null;
  scope: string;
  status: string;
  category: string;
  load_type: string;
  name: string;
  main_muscle: string | null;
  supporting_muscles: string[];
  difficulty: string | null;
  equipment: string[];
  is_home: boolean;
  is_gym: boolean;
  is_bodyweight: boolean;
  image_reference: string | null;
  execution_instructions: string | null;
  common_mistakes: string | null;
  safety_notes: string | null;
  version: number;
  created_at: Date | string;
  updated_at: Date | string;
};

export type CreateTrainingExerciseResult =
  | { outcome: 'created'; exercise: TrainingExercise }
  | { outcome: 'conflict' };

export type TrainingExerciseRepository = {
  list(
    userId: string,
    query: ListTrainingExercisesQuery,
  ): Promise<{ exercises: TrainingExercise[]; hasMore: boolean }>;
  findVisible(userId: string, exerciseId: string): Promise<TrainingExercise | null>;
  findVisibleMany(userId: string, exerciseIds: string[]): Promise<TrainingExercise[]>;
  create(userId: string, input: CreateTrainingExerciseInput): Promise<CreateTrainingExerciseResult>;
};

const exerciseSelect = `
  select exercise.id,exercise.system_key,exercise.scope,exercise.status,
    exercise.category,exercise.load_type,exercise.name,exercise.main_muscle,
    exercise.supporting_muscles,exercise.difficulty,exercise.equipment,
    exercise.is_home,exercise.is_gym,exercise.is_bodyweight,
    exercise.image_reference,exercise.execution_instructions,
    exercise.common_mistakes,exercise.safety_notes,exercise.version,
    exercise.created_at,exercise.updated_at
  from public.training_exercises_v2 exercise`;

export const trainingExerciseVisibilitySql = `
  exercise.status = 'active'
  and (
    (exercise.scope = 'system' and exercise.owner_user_id is null)
    or (exercise.scope = 'user' and exercise.owner_user_id = $1)
  )`;

export function mapTrainingExerciseRow(row: TrainingExerciseRow): TrainingExercise {
  return trainingExerciseSchema.parse({
    id: String(row.id),
    systemKey: row.system_key,
    scope: row.scope,
    status: row.status,
    category: row.category,
    loadType: row.load_type,
    name: row.name,
    mainMuscle: row.main_muscle,
    supportingMuscles: row.supporting_muscles,
    difficulty: row.difficulty,
    equipment: row.equipment,
    isHome: row.is_home,
    isGym: row.is_gym,
    isBodyweight: row.is_bodyweight,
    imageReference: row.image_reference,
    executionInstructions: row.execution_instructions,
    commonMistakes: row.common_mistakes,
    safetyNotes: row.safety_notes,
    version: Number(row.version),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  });
}

function escapeLike(value: string): string {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('%', '\\%')
    .replaceAll('_', '\\_');
}

// Derived from the system catalog itself (20260726200000_training_v2_system_exercise_
// catalog.sql), the only source of truth for this convention: every mobility (6/6),
// stretching (8/8) and cardio (6/6) system exercise uses 'no_weight_tracking' -- unanimous,
// not a guess. Strength is the one category that actually varies by exercise (total_weight
// 43/70, per_hand 13/70, per_side 4/70, bodyweight_only 4/70, added_weight_only 4/70,
// no_weight_tracking 2/70); 'total_weight' is its clear plurality and the value already
// used for every private exercise before category-awareness existed.
function loadTypeForCategory(category: string): string {
  return category === 'strength' ? 'total_weight' : 'no_weight_tracking';
}

export function createTrainingExerciseRepository(
  db: Queryable = getPgPool(),
): TrainingExerciseRepository {
  return {
    async list(userId, query) {
      const values: unknown[] = [userId];
      const bind = (value: unknown) => {
        values.push(value);
        return `$${values.length}`;
      };
      const filters = [trainingExerciseVisibilitySql];

      if (query.search !== undefined) {
        const parameter = bind(`%${escapeLike(query.search)}%`);
        filters.push(`lower(exercise.name) like lower(${parameter}) escape E'\\\\'`);
      }
      if (query.category !== undefined) {
        filters.push(`exercise.category = ${bind(query.category)}`);
      }
      if (query.loadType !== undefined) {
        filters.push(`exercise.load_type = ${bind(query.loadType)}`);
      }
      if (query.muscle !== undefined) {
        const parameter = bind(query.muscle);
        filters.push(`(
          lower(exercise.main_muscle) = lower(${parameter})
          or exists (
            select 1 from unnest(exercise.supporting_muscles) muscle
            where lower(muscle) = lower(${parameter})
          )
        )`);
      }
      if (query.equipment !== undefined) {
        const parameter = bind(query.equipment);
        filters.push(`exists (
          select 1 from unnest(exercise.equipment) equipment
          where lower(equipment) = lower(${parameter})
        )`);
      }
      if (query.environment === 'home') filters.push('exercise.is_home = true');
      if (query.environment === 'gym') filters.push('exercise.is_gym = true');
      if (query.scope !== undefined) filters.push(`exercise.scope = ${bind(query.scope)}`);

      const limitParameter = bind(query.limit + 1);
      const offsetParameter = bind(query.page * query.limit);
      const result = await db.query<TrainingExerciseRow>(`
        ${exerciseSelect}
        where ${filters.join('\n          and ')}
        order by lower(exercise.name) asc, exercise.id asc
        limit ${limitParameter}
        offset ${offsetParameter}
      `, values);
      return {
        exercises: result.rows.slice(0, query.limit).map(mapTrainingExerciseRow),
        hasMore: result.rows.length > query.limit,
      };
    },

    async findVisible(userId, exerciseId) {
      const result = await db.query<TrainingExerciseRow>(`
        ${exerciseSelect}
        where ${trainingExerciseVisibilitySql}
          and exercise.id = $2
        limit 1
      `, [userId, exerciseId]);
      return result.rows[0] ? mapTrainingExerciseRow(result.rows[0]) : null;
    },

    async findVisibleMany(userId, exerciseIds) {
      if (exerciseIds.length === 0) return [];
      const result = await db.query<TrainingExerciseRow>(`
        ${exerciseSelect}
        where ${trainingExerciseVisibilitySql}
          and exercise.id = any($2::uuid[])
        order by exercise.id asc
      `, [userId, exerciseIds]);
      return result.rows.map(mapTrainingExerciseRow);
    },

    async create(userId, input) {
      // training_exercises_v2_active_user_name_unique_idx (added in
      // 20260729060000_training_v2_private_exercise_name_uniqueness.sql) is the real,
      // race-safe guard: a partial unique index on (owner_user_id, normalized name) for
      // active private exercises. `on conflict ... do nothing` relies on Postgres resolving
      // the conflict at the database level, so two concurrent creates of the same
      // normalized name can never both succeed, regardless of application-level timing.
      const result = await db.query<TrainingExerciseRow>(`
        insert into public.training_exercises_v2
          (scope, owner_user_id, status, category, load_type, name, main_muscle)
        values ('user', $1, 'active', $4, $5, $2, $3)
        on conflict (owner_user_id, (lower(regexp_replace(btrim(name), '\\s+', ' ', 'g'))))
          where scope = 'user' and status = 'active'
        do nothing
        returning id, system_key, scope, status, category, load_type, name, main_muscle,
          supporting_muscles, difficulty, equipment, is_home, is_gym, is_bodyweight,
          image_reference, execution_instructions, common_mistakes, safety_notes, version,
          created_at, updated_at
      `, [userId, input.name, input.mainMuscle, input.category, loadTypeForCategory(input.category)]);

      if (result.rows.length === 0) return { outcome: 'conflict' };
      return { outcome: 'created', exercise: mapTrainingExerciseRow(result.rows[0]) };
    },
  };
}
