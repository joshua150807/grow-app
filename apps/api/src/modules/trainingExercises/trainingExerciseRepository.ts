import {
  trainingExerciseSchema,
  type ListTrainingExercisesQuery,
  type TrainingExercise,
} from '@grow/shared/src/training/exercises.js';
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

export type TrainingExerciseRepository = {
  list(
    userId: string,
    query: ListTrainingExercisesQuery,
  ): Promise<{ exercises: TrainingExercise[]; hasMore: boolean }>;
  findVisible(userId: string, exerciseId: string): Promise<TrainingExercise | null>;
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
  };
}
