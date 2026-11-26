import type {
  PlanTreeInput,
  TrainingTemplate,
  TrainingTemplateUserProjection,
} from '@grow/shared/src/training/plans.js';
import { trainingTemplateUserProjectionSchema } from '@grow/shared/src/training/plans.js';
import {
  applyPlanActivation,
  insertTree,
  transaction,
  type Client,
  type Database,
} from '../trainingPlans/trainingPlanRepository.js';
import { loadTemplateDetail } from './trainingTemplateRepository.js';
import { getPgPool } from '../../db/client.js';

export type TrainingTemplateSaveOutcome =
  | { outcome: 'not_found' }
  | { outcome: 'ok'; userPlan: TrainingTemplateUserProjection };

export type TrainingTemplateSaveRepository = {
  save(userId: string, templateId: string): Promise<TrainingTemplateSaveOutcome>;
  unsave(userId: string, templateId: string): Promise<TrainingTemplateSaveOutcome>;
  activate(userId: string, templateId: string): Promise<TrainingTemplateSaveOutcome>;
};

type InstanceRow = {
  id: string; status: string; version: number;
  current_revision_id: string | null; saved_at: Date | string | null;
};

function throwContractError(): never {
  const error = new Error('Internal training template contract violation.');
  error.name = 'TrainingTemplateContractError';
  throw error;
}

function projectionFrom(row: { id: string; status: string; saved_at: Date | string | null }): TrainingTemplateUserProjection {
  const parsed = trainingTemplateUserProjectionSchema.safeParse({
    isSaved: row.saved_at !== null,
    isActive: row.status === 'active',
    userPlanId: String(row.id),
  });
  if (!parsed.success) throwContractError();
  return parsed.data;
}

const emptyProjection: TrainingTemplateUserProjection = { isSaved: false, isActive: false, userPlanId: null };

// unsave() must never create an instance, so it can't reuse getOrCreateInstance's
// loadTemplateDetail() call when there's nothing to unsave — that would load the full template
// tree just to answer a yes/no question. This mirrors only the eligibility half of
// loadTemplateDetail's own filter (status='active' and current_revision_id is not null), the
// same condition that already gates whether a *new* instance could ever be created here.
async function isEligibleForNewInstance(client: Client, templateId: string): Promise<boolean> {
  const result = await client.query(`
    select 1 from public.training_templates_v2
    where id=$1 and status='active' and current_revision_id is not null
    limit 1
  `, [templateId]);
  return result.rows.length > 0;
}

// The template's own tree is already a validated, immutable snapshot (unit/exercise/target-set
// logical keys and positions are unique by the same DB constraints as the plan-side tables —
// see 20260726180000_training_v2_plan_core.sql). Reshaping it into a PlanTreeInput lets the
// copy go through the exact same insertTree() used by the ordinary create()/update() paths
// (including its exercise-availability re-check), instead of duplicating that insert logic.
function planTreeInputFromTemplate(template: TrainingTemplate): PlanTreeInput {
  return {
    name: template.name,
    units: template.revision.units.map((unit) => ({
      logicalUnitKey: unit.logicalUnitKey,
      name: unit.name,
      unitType: unit.unitType,
      orderIndex: unit.orderIndex,
      exercises: unit.exercises.map((exercise) => ({
        logicalTargetExerciseKey: exercise.logicalTargetExerciseKey,
        exerciseId: exercise.exerciseId,
        orderIndex: exercise.orderIndex,
        note: exercise.note,
        targetSets: exercise.targetSets.map((set) => ({
          logicalTargetSetKey: set.logicalTargetSetKey,
          orderIndex: set.orderIndex,
          setType: set.setType,
          targetWeightKg: set.targetWeightKg,
          targetReps: set.targetReps,
          targetRir: set.targetRir,
          plannedRestSeconds: set.plannedRestSeconds,
          importedFromLegacyPlan: false,
        })),
      })),
    })),
  };
}

// The shared get-or-create/copy step for save() and activate(): reuses (and locks) an existing
// per-user instance if one already exists for this template, regardless of the template's own
// current status — an existing instance must stay usable even after its template is later
// archived or unpublished. Only creating a brand-new instance requires the template to still be
// active with a current revision (the same eligibility loadTemplateDetail's read path already
// enforces). New instances always start as 'draft' and unsaved; save()/activate() layer their
// own narrow follow-up update on top of whichever instance this returns.
async function getOrCreateInstance(
  client: Client, userId: string, templateId: string,
): Promise<{ outcome: 'not_found' } | { outcome: 'ok'; row: InstanceRow }> {
  const existing = await client.query<InstanceRow>(`
    select id,status,version,current_revision_id,saved_at from public.training_plans_v2
    where user_id=$1 and source_template_id=$2 for update
  `, [userId, templateId]);
  if (existing.rows[0]) return { outcome: 'ok', row: existing.rows[0] };

  const detail = await loadTemplateDetail(client, userId, templateId);
  if (!detail) return { outcome: 'not_found' };
  const { template } = detail;

  const inserted = await client.query<{ id: string }>(`
    insert into public.training_plans_v2(user_id,name,status,source_template_id)
    values ($1,$2,'draft',$3)
    on conflict (user_id,source_template_id) where source_template_id is not null do nothing
    returning id
  `, [userId, template.name, templateId]);

  if (!inserted.rows[0]) {
    // Lost the create race to a concurrent save/activate for the same user+template — reuse
    // whatever that request just committed instead of copying the tree a second time.
    const raced = await client.query<InstanceRow>(`
      select id,status,version,current_revision_id,saved_at from public.training_plans_v2
      where user_id=$1 and source_template_id=$2 for update
    `, [userId, templateId]);
    return { outcome: 'ok', row: raced.rows[0] };
  }

  const planId = String(inserted.rows[0].id);
  const tree = await insertTree(
    client, userId, planId, 1, planTreeInputFromTemplate(template), template.revision.id,
  );
  await client.query(`update public.training_plans_v2 set current_revision_id=$1
    where id=$2 and user_id=$3`, [tree.revisionId, planId, userId]);
  if (template.revision.defaultWeeklyGoal !== null) {
    await client.query(`insert into public.training_weekly_goal_versions_v2
      (plan_id,user_id,target_sessions_per_week,effective_from) values ($1,$2,$3,now())`,
    [planId, userId, template.revision.defaultWeeklyGoal]);
  }
  return {
    outcome: 'ok',
    row: {
      id: planId, status: 'draft', version: 1, current_revision_id: tree.revisionId, saved_at: null,
    },
  };
}

export function createTrainingTemplateSaveRepository(
  db: Database = getPgPool(),
): TrainingTemplateSaveRepository {
  return {
    save(userId, templateId) {
      return transaction(db, async (client): Promise<TrainingTemplateSaveOutcome> => {
        const instance = await getOrCreateInstance(client, userId, templateId);
        if (instance.outcome === 'not_found') return { outcome: 'not_found' };
        const { row } = instance;
        if (row.saved_at !== null) return { outcome: 'ok', userPlan: projectionFrom(row) };
        const updated = await client.query<InstanceRow>(`
          update public.training_plans_v2 set saved_at=now(),version=version+1
          where id=$1 and user_id=$2 and saved_at is null
          returning id,status,version,current_revision_id,saved_at
        `, [row.id, userId]);
        return { outcome: 'ok', userPlan: projectionFrom(updated.rows[0] ?? row) };
      });
    },

    unsave(userId, templateId) {
      return transaction(db, async (client): Promise<TrainingTemplateSaveOutcome> => {
        const existing = await client.query<InstanceRow>(`
          select id,status,version,current_revision_id,saved_at from public.training_plans_v2
          where user_id=$1 and source_template_id=$2 for update
        `, [userId, templateId]);
        const row = existing.rows[0];
        if (!row) {
          const eligible = await isEligibleForNewInstance(client, templateId);
          return eligible ? { outcome: 'ok', userPlan: emptyProjection } : { outcome: 'not_found' };
        }
        if (row.saved_at === null) return { outcome: 'ok', userPlan: projectionFrom(row) };
        const updated = await client.query<InstanceRow>(`
          update public.training_plans_v2 set saved_at=null,version=version+1
          where id=$1 and user_id=$2 and saved_at is not null
          returning id,status,version,current_revision_id,saved_at
        `, [row.id, userId]);
        return { outcome: 'ok', userPlan: projectionFrom(updated.rows[0] ?? row) };
      });
    },

    activate(userId, templateId) {
      return transaction(db, async (client): Promise<TrainingTemplateSaveOutcome> => {
        const instance = await getOrCreateInstance(client, userId, templateId);
        if (instance.outcome === 'not_found') return { outcome: 'not_found' };
        const { row } = instance;
        if (row.status === 'active') return { outcome: 'ok', userPlan: projectionFrom(row) };
        await applyPlanActivation(
          client, userId, row.id, row.current_revision_id!, row.status === 'archived',
        );
        const updated = await client.query<InstanceRow>(`
          select id,status,version,current_revision_id,saved_at from public.training_plans_v2
          where id=$1 and user_id=$2
        `, [row.id, userId]);
        return { outcome: 'ok', userPlan: projectionFrom(updated.rows[0]) };
      });
    },
  };
}
