import type {
  TrainingTemplate,
  TrainingTemplateListItem,
  TrainingTemplateSummary,
  TrainingTemplateUserProjection,
} from '@grow/shared/src/training/plans.js';
import {
  trainingTemplateSchema,
  trainingTemplateSummarySchema,
  trainingTemplateUserProjectionSchema,
} from '@grow/shared/src/training/plans.js';
import type pg from 'pg';
import { getPgPool } from '../../db/client.js';

type Queryable = Pick<pg.Pool, 'query'>;

export type TrainingTemplateRepository = {
  list(userId: string): Promise<TrainingTemplateListItem[]>;
  find(
    userId: string,
    templateId: string,
  ): Promise<{ template: TrainingTemplate; userPlan: TrainingTemplateUserProjection } | null>;
};

type TemplateSummaryRow = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  version: number;
  current_revision_id: string | null;
  image_reference: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  user_plan_id: string | null;
  user_plan_saved_at: Date | string | null;
  user_plan_status: string | null;
};

const templateSummarySelect = `
  select t.id,t.name,t.description,t.status,t.version,t.current_revision_id,
    t.image_reference,t.created_at,t.updated_at,
    plan.id as user_plan_id,plan.saved_at as user_plan_saved_at,plan.status as user_plan_status
  from public.training_templates_v2 t
  left join public.training_plans_v2 plan
    on plan.source_template_id = t.id and plan.user_id = $1`;

const iso = (value: Date | string) => new Date(value).toISOString();

export function mapTemplateSummary(row: TemplateSummaryRow): TrainingTemplateSummary {
  const parsed = trainingTemplateSummarySchema.safeParse({
    id: String(row.id),
    name: String(row.name),
    description: row.description,
    status: row.status,
    version: Number(row.version),
    currentRevisionId: row.current_revision_id === null ? null : String(row.current_revision_id),
    imageReference: row.image_reference,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  });
  if (!parsed.success) throwContractError();
  return parsed.data;
}

export function mapUserProjection(row: TemplateSummaryRow): TrainingTemplateUserProjection {
  const parsed = trainingTemplateUserProjectionSchema.safeParse({
    isSaved: row.user_plan_saved_at !== null,
    isActive: row.user_plan_status === 'active',
    userPlanId: row.user_plan_id === null ? null : String(row.user_plan_id),
  });
  if (!parsed.success) throwContractError();
  return parsed.data;
}

function throwContractError(): never {
  const error = new Error('Internal training template contract violation.');
  error.name = 'TrainingTemplateContractError';
  throw error;
}

export async function loadTemplateDetail(
  db: Queryable,
  userId: string,
  templateId: string,
): Promise<{ template: TrainingTemplate; userPlan: TrainingTemplateUserProjection } | null> {
  const templates = await db.query<TemplateSummaryRow>(`
    ${templateSummarySelect}
    where t.id=$2 and t.status='active'
  `, [userId, templateId]);
  const row = templates.rows[0];
  if (!row?.current_revision_id) return null;

  const revisions = await db.query<{
    id: string; revision_number: number; created_at: Date | string; default_weekly_goal: number | null;
  }>(`
    select id,revision_number,created_at,default_weekly_goal from public.training_template_revisions_v2
    where id=$1 and template_id=$2
  `, [row.current_revision_id, templateId]);
  const revision = revisions.rows[0];
  if (!revision) return null;

  const units = await db.query<{
    id: string; logical_unit_key: string; name: string;
    unit_type: TrainingTemplate['revision']['units'][number]['unitType']; order_index: number;
  }>(`select id,logical_unit_key,name,unit_type,order_index from public.training_template_units_v2
      where revision_id=$1 and template_id=$2 order by order_index`,
  [revision.id, templateId]);
  const exercises = await db.query<{
    id: string; unit_id: string; logical_target_exercise_key: string;
    exercise_id: string; order_index: number; note: string | null;
  }>(`select id,unit_id,logical_target_exercise_key,exercise_id,order_index,note
      from public.training_template_exercises_v2
      where revision_id=$1 and template_id=$2 order by unit_id,order_index`,
  [revision.id, templateId]);
  const targetSets = await db.query<{
    id: string; target_exercise_id: string; logical_target_set_key: string; order_index: number;
    set_type: 'warmup' | 'work' | 'drop'; target_weight_kg: string | number | null;
    target_reps_min: number | null; target_reps_max: number | null; target_rir: number | null;
    planned_rest_seconds: number;
  }>(`select id,target_exercise_id,logical_target_set_key,order_index,set_type,target_weight_kg,
        target_reps_min,target_reps_max,target_rir,planned_rest_seconds
      from public.training_template_target_sets_v2
      where revision_id=$1 and template_id=$2 order by target_exercise_id,order_index`,
  [revision.id, templateId]);

  const parsed = trainingTemplateSchema.safeParse({
    ...mapTemplateSummary(row),
    revision: {
      id: String(revision.id), revisionNumber: Number(revision.revision_number),
      createdAt: iso(revision.created_at),
      defaultWeeklyGoal: revision.default_weekly_goal === null ? null : Number(revision.default_weekly_goal),
      units: units.rows.map((unit) => ({
        id: String(unit.id), logicalUnitKey: String(unit.logical_unit_key), name: String(unit.name),
        unitType: unit.unit_type, orderIndex: Number(unit.order_index),
        exercises: exercises.rows.filter((item) => item.unit_id === unit.id).map((item) => ({
          id: String(item.id), logicalTargetExerciseKey: String(item.logical_target_exercise_key),
          exerciseId: String(item.exercise_id), orderIndex: Number(item.order_index), note: item.note,
          targetSets: targetSets.rows.filter((set) => set.target_exercise_id === item.id).map((set) => ({
            id: String(set.id), logicalTargetSetKey: String(set.logical_target_set_key),
            orderIndex: Number(set.order_index), setType: set.set_type,
            targetWeightKg: set.target_weight_kg === null ? null : Number(set.target_weight_kg),
            targetReps: set.target_reps_min === null || set.target_reps_max === null ? null
              : { minimum: Number(set.target_reps_min), maximum: Number(set.target_reps_max) },
            targetRir: set.target_rir === null ? null : Number(set.target_rir),
            plannedRestSeconds: Number(set.planned_rest_seconds),
          })),
        })),
      })),
    },
  });
  if (!parsed.success) throwContractError();
  return { template: parsed.data, userPlan: mapUserProjection(row) };
}

export function createTrainingTemplateRepository(
  db: Queryable = getPgPool(),
): TrainingTemplateRepository {
  return {
    async list(userId) {
      const result = await db.query<TemplateSummaryRow>(`
        ${templateSummarySelect}
        where t.status='active' and t.current_revision_id is not null
        order by t.created_at asc, t.id asc
      `, [userId]);
      return result.rows.map((row) => ({
        template: mapTemplateSummary(row),
        userPlan: mapUserProjection(row),
      }));
    },
    find(userId, templateId) { return loadTemplateDetail(db, userId, templateId); },
  };
}
