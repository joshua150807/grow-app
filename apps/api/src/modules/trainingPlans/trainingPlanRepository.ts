import type {
  CreateTrainingPlanInput, PlanExerciseDraftInput, PlanTreeInput,
  TrainingPlan, TrainingPlanSummary, UpdateTrainingPlanInput,
} from '@grow/shared/src/training/plans.js';
import {
  trainingPlanSchema,
  trainingPlanSummarySchema,
} from '@grow/shared';
import { resolveUiMuscleGroup } from '@grow/shared';
import type pg from 'pg';
import { getPgPool } from '../../db/client.js';
import { createTrainingExerciseRepository } from '../trainingExercises/trainingExerciseRepository.js';
import { fingerprintTrainingPlanCreate, TrainingPlanCreateConflictError } from './trainingPlanCreateFingerprint.js';

export type Database = Pick<pg.Pool, 'query' | 'connect'>;
export type Client = pg.PoolClient;
export type MutationResult =
  | { outcome: 'ok'; planId: string }
  | { outcome: 'not_found' | 'version_conflict' | 'status_conflict' | 'schedule_conflict' };
export type TrainingPlanRepository = {
  list(userId: string): Promise<TrainingPlanSummary[]>;
  find(userId: string, planId: string): Promise<TrainingPlan | null>;
  create(userId: string, input: CreateTrainingPlanInput): Promise<string>;
  update(userId: string, planId: string, input: UpdateTrainingPlanInput): Promise<MutationResult>;
  activate(userId: string, planId: string, expectedVersion: number, reactivation: boolean): Promise<MutationResult>;
  schedule(
    userId: string,
    planId: string,
    expectedVersion: number,
    startDate: string,
    effectiveAt: Date,
    timeZone: string,
  ): Promise<MutationResult>;
  archive(userId: string, planId: string, expectedVersion: number): Promise<MutationResult>;
  updateWeeklyGoal(userId: string, planId: string, expectedVersion: number, weeklyGoal: number): Promise<MutationResult>;
  delete(userId: string, planId: string): Promise<MutationResult>;
};

export type PlanRow = {
  id: string; name: string; status: TrainingPlanSummary['status']; version: number;
  current_revision_id: string | null; weekly_goal: number | null;
  created_at: Date | string; updated_at: Date | string;
  activated_at: Date | string | null; archived_at: Date | string | null;
  schedule_start_date: string | null;
  schedule_timezone: string | null;
  schedule_effective_at: Date | string | null;
  source_template_id: string | null;
  saved_at: Date | string | null;
  template_image_reference: string | null;
  next_unit_id: string | null;
  next_unit_logical_key: string | null;
  next_unit_order_index: number | null;
};
type ExerciseRow = { id: string; scope: 'system' | 'user'; owner_user_id: string | null };

const iso = (value: Date | string) => new Date(value).toISOString();
const nullableIso = (value: Date | string | null) => value === null ? null : iso(value);
const planSummarySelect = `
  select plan.id,plan.name,plan.status,plan.version,plan.current_revision_id,
    plan.created_at,plan.updated_at,plan.activated_at,plan.archived_at,
    plan.source_template_id,plan.saved_at,template.image_reference as template_image_reference,
    schedule.start_date as schedule_start_date,
    schedule.timezone as schedule_timezone,
    schedule.effective_at as schedule_effective_at,
    (select goal.target_sessions_per_week from public.training_weekly_goal_versions_v2 goal
     where goal.plan_id=plan.id and goal.user_id=plan.user_id
     order by goal.effective_from desc limit 1) as weekly_goal,
    coalesce(next_unit.id,fallback_next_unit.id) as next_unit_id,
    coalesce(next_unit.logical_unit_key,fallback_next_unit.logical_unit_key) as next_unit_logical_key,
    coalesce(next_unit.order_index,fallback_next_unit.order_index) as next_unit_order_index
  from public.training_plans_v2 plan
  left join public.training_templates_v2 template on template.id=plan.source_template_id
  left join lateral (
    select activation.start_date::text as start_date,activation.timezone,activation.effective_at
    from public.training_plan_activations_v2 activation
    where activation.plan_id=plan.id and activation.user_id=plan.user_id
      and activation.status='pending'
    order by activation.effective_at asc,activation.id asc
    limit 1
  ) schedule on true
  left join public.training_plan_cycle_states_v2 cycle
    on cycle.plan_id=plan.id and cycle.user_id=plan.user_id
  left join public.training_plan_units_v2 next_unit
    on next_unit.id=cycle.next_unit_id and next_unit.revision_id=cycle.revision_id
      and next_unit.plan_id=cycle.plan_id and next_unit.user_id=cycle.user_id
      and next_unit.unit_type='strength'
  -- The cycle tracker's own target can be missing entirely (no cycle_states row: a plan
  -- that was never activated) or point at a unit type this vertical slice cannot start as a
  -- session (rest/run/mobility/stretching -- the next_unit join above already excludes those
  -- via unit_type='strength', leaving it null). Either way, the deterministic substitute is
  -- the next strength unit at/after the cycle position, wrapping once when needed.
  -- Without a cycle it starts at the first strength unit. This read does not advance state.
  left join lateral (
    select unit.id,unit.logical_unit_key,unit.order_index
    from public.training_plan_units_v2 unit
    where unit.revision_id=plan.current_revision_id and unit.plan_id=plan.id and unit.user_id=plan.user_id
      and unit.unit_type='strength'
    order by
      case when unit.order_index >= coalesce(cycle.next_order_index, 0) then 0 else 1 end,
      unit.order_index asc
    limit 1
  ) fallback_next_unit on next_unit.id is null`;

export function mapTrainingPlanSummary(row: PlanRow): TrainingPlanSummary {
  const hasSchedule = row.schedule_start_date !== null
    || row.schedule_timezone !== null
    || row.schedule_effective_at !== null;
  const parsed = trainingPlanSummarySchema.safeParse({
    id: String(row.id), name: String(row.name), status: row.status, version: Number(row.version),
    currentRevisionId: row.current_revision_id === null ? null : String(row.current_revision_id),
    weeklyGoal: row.weekly_goal === null ? null : Number(row.weekly_goal),
    createdAt: iso(row.created_at), updatedAt: iso(row.updated_at),
    activatedAt: nullableIso(row.activated_at), archivedAt: nullableIso(row.archived_at),
    schedule: hasSchedule ? {
      startDate: String(row.schedule_start_date),
      timeZone: String(row.schedule_timezone),
      effectiveAt: iso(row.schedule_effective_at!),
    } : null,
    sourceTemplateId: row.source_template_id === null ? null : String(row.source_template_id),
    savedAt: nullableIso(row.saved_at),
    sourceTemplateImageReference: row.template_image_reference,
    nextUnit: row.next_unit_id === null ? null : {
      id: String(row.next_unit_id),
      logicalUnitKey: String(row.next_unit_logical_key),
      orderIndex: Number(row.next_unit_order_index),
    },
  });
  if (!parsed.success) {
    const error = new Error('Internal training plan contract violation.');
    error.name = 'TrainingPlanContractError';
    throw error;
  }
  return parsed.data;
}

export async function transaction<T>(db: Database, operation: (client: Client) => Promise<T>): Promise<T> {
  const client = await db.connect();
  try {
    await client.query('begin');
    const result = await operation(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export type ResolvedDraftExercise = { exerciseId: string; scope: 'system' | 'user'; ownerUserId: string | null };

// Resolves one private-exercise draft to a concrete exercise id, in the mandatory order:
//   1. an exact-normalized-name match among the caller's own active private exercises wins
//      outright (updating its canonical main_muscle in place if the draft explicitly names a
//      different one) — a same-named system exercise never overrides this;
//   2. otherwise, an exact-normalized-name match among active system exercises is reused
//      as-is, but only if the draft's category and its (20-to-9-mapped) muscle group both
//      agree with that system exercise exactly — system exercises are never mutated and
//      never silently duplicated into a needless private copy when the draft describes them
//      exactly;
//   3. otherwise a new private exercise is created (or, on a create race, the winner's row is
//      reused) via trainingExerciseRepository's own create() — including its
//      loadType-from-category derivation and its race-safe `on conflict ... do nothing`
//      insert — against this same transactional client, so there is exactly one
//      normalization/creation implementation, not a second one.
async function resolveExerciseDraft(
  client: Client, userId: string, draft: PlanExerciseDraftInput,
): Promise<ResolvedDraftExercise> {
  const findOwnExactMatch = () => client.query<{ id: string; main_muscle: string | null }>(`
    select id, main_muscle from public.training_exercises_v2
    where owner_user_id = $1 and scope = 'user' and status = 'active'
      and lower(regexp_replace(btrim(name), '\\s+', ' ', 'g'))
        = lower(regexp_replace(btrim($2), '\\s+', ' ', 'g'))
    for update
  `, [userId, draft.name]);

  async function useOwnMatch(row: { id: string; main_muscle: string | null }): Promise<ResolvedDraftExercise> {
    if (row.main_muscle !== draft.mainMuscle) {
      await client.query(
        'update public.training_exercises_v2 set main_muscle=$1 where id=$2',
        [draft.mainMuscle, row.id],
      );
    }
    return { exerciseId: String(row.id), scope: 'user', ownerUserId: userId };
  }

  const existingOwn = await findOwnExactMatch();
  if (existingOwn.rows[0]) return useOwnMatch(existingOwn.rows[0]);

  const systemMatch = await client.query<{ id: string; main_muscle: string | null; category: string }>(`
    select id, main_muscle, category from public.training_exercises_v2
    where scope = 'system' and status = 'active'
      and lower(regexp_replace(btrim(name), '\\s+', ' ', 'g'))
        = lower(regexp_replace(btrim($1), '\\s+', ' ', 'g'))
  `, [draft.name]);
  const system = systemMatch.rows[0];
  if (
    system
    && system.category === draft.category
    && resolveUiMuscleGroup(system.main_muscle) === draft.mainMuscle
  ) {
    return { exerciseId: String(system.id), scope: 'system', ownerUserId: null };
  }

  const created = await createTrainingExerciseRepository(client).create(userId, {
    name: draft.name, mainMuscle: draft.mainMuscle, category: draft.category,
  });
  if (created.outcome === 'created') {
    return { exerciseId: created.exercise.id, scope: 'user', ownerUserId: userId };
  }

  // Lost a create race against a concurrent request for the exact same normalized name
  // (another row in this same plan submission already resolved it, or a fully separate
  // concurrent save) — the winner's row exists now; reuse it exactly like an already-known
  // match would be.
  const afterConflict = await findOwnExactMatch();
  if (!afterConflict.rows[0]) {
    const error = new Error('Private exercise draft resolution raced without a winner.');
    error.name = 'TrainingExerciseNotAvailableError';
    throw error;
  }
  return useOwnMatch(afterConflict.rows[0]);
}

export async function insertTree(
  client: Client, userId: string, planId: string, revisionNumber: number, input: PlanTreeInput,
  sourceTemplateRevisionId: string | null = null,
) {
  // Every exercise row sharing a draft logicalKey must resolve to the exact same exercise id
  // — resolve each unique key exactly once (not once per row) before validating direct
  // exerciseId references below.
  const draftsByLogicalKey = new Map<string, PlanExerciseDraftInput>();
  for (const unit of input.units) {
    for (const exercise of unit.exercises) {
      if (exercise.exerciseDraft) draftsByLogicalKey.set(exercise.exerciseDraft.logicalKey, exercise.exerciseDraft);
    }
  }
  const resolvedDrafts = new Map<string, ResolvedDraftExercise>();
  for (const [logicalKey, draft] of draftsByLogicalKey) {
    resolvedDrafts.set(logicalKey, await resolveExerciseDraft(client, userId, draft));
  }

  const requestedIds = [...new Set(
    input.units.flatMap((unit) => unit.exercises)
      .filter((exercise) => !exercise.exerciseDraft)
      .map((exercise) => exercise.exerciseId!),
  )];
  const available = requestedIds.length === 0 ? { rows: [] as ExerciseRow[] } : await client.query<ExerciseRow>(`
    select id,scope,owner_user_id from public.training_exercises_v2
    where id=any($1::uuid[]) and status='active'
      and ((scope='system' and owner_user_id is null) or (scope='user' and owner_user_id=$2))
    for share
  `, [requestedIds, userId]);
  const exercises = new Map(available.rows.map((row) => [String(row.id), row]));
  if (exercises.size !== requestedIds.length) {
    const error = new Error('One or more exercises are unavailable.');
    error.name = 'TrainingExerciseNotAvailableError';
    throw error;
  }
  const revision = await client.query<{ id: string }>(`
    insert into public.training_plan_revisions_v2(plan_id,user_id,revision_number,source_template_revision_id)
    values ($1,$2,$3,$4) returning id`, [planId, userId, revisionNumber, sourceTemplateRevisionId]);
  const revisionId = String(revision.rows[0].id);
  const units: Array<{ id: string; logicalKey: string; orderIndex: number }> = [];
  for (const unit of [...input.units].sort((a, b) => a.orderIndex - b.orderIndex)) {
    const insertedUnit = await client.query<{ id: string }>(`
      insert into public.training_plan_units_v2
        (revision_id,plan_id,user_id,logical_unit_key,name,unit_type,order_index)
      values ($1,$2,$3,$4,$5,$6,$7) returning id
    `, [revisionId, planId, userId, unit.logicalUnitKey, unit.name, unit.unitType, unit.orderIndex]);
    const unitId = String(insertedUnit.rows[0].id);
    units.push({ id: unitId, logicalKey: unit.logicalUnitKey, orderIndex: unit.orderIndex });
    for (const exercise of [...unit.exercises].sort((a, b) => a.orderIndex - b.orderIndex)) {
      let exerciseId: string;
      let source: { scope: 'system' | 'user'; owner_user_id: string | null };
      if (exercise.exerciseDraft) {
        const resolved = resolvedDrafts.get(exercise.exerciseDraft.logicalKey)!;
        exerciseId = resolved.exerciseId;
        source = { scope: resolved.scope, owner_user_id: resolved.ownerUserId };
      } else {
        exerciseId = exercise.exerciseId!;
        source = exercises.get(exercise.exerciseId!)!;
      }
      const insertedExercise = await client.query<{ id: string }>(`
        insert into public.training_plan_exercises_v2
          (unit_id,revision_id,plan_id,user_id,exercise_id,exercise_scope,exercise_owner_user_id,
           logical_target_exercise_key,order_index,note)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id
      `, [unitId, revisionId, planId, userId, exerciseId, source.scope,
        source.owner_user_id, exercise.logicalTargetExerciseKey, exercise.orderIndex, exercise.note]);
      const targetExerciseId = String(insertedExercise.rows[0].id);
      for (const set of [...exercise.targetSets].sort((a, b) => a.orderIndex - b.orderIndex)) {
        await client.query(`
          insert into public.training_plan_target_sets_v2
            (target_exercise_id,unit_id,revision_id,plan_id,user_id,logical_target_set_key,
             order_index,set_type,target_weight_kg,target_reps_min,target_reps_max,target_rir,
             planned_rest_seconds,imported_from_legacy_plan)
          values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        `, [targetExerciseId, unitId, revisionId, planId, userId, set.logicalTargetSetKey,
          set.orderIndex, set.setType, set.targetWeightKg, set.targetReps?.minimum ?? null,
          set.targetReps?.maximum ?? null, set.targetRir, set.plannedRestSeconds,
          set.importedFromLegacyPlan]);
      }
    }
  }
  return { revisionId, units };
}

// Shared by the plan-level activate()/reactivate() below and by the template-driven
// save/activate flow (trainingTemplateSaveRepository.ts) — the archive-old-active-plan,
// cancel-pending-activation and set-active-then-reset-cycle sequence must stay identical
// for both callers, since a template-derived plan is otherwise an ordinary training_plans_v2
// row and must obey the exact same one-active-plan-per-user invariant.
//
// Self-defends against a tombstoned target instead of trusting every caller to have already
// excluded `deleted_at is not null` under its own lock (both current callers do, but this is
// an exported, explicitly "shared" function — a future caller, e.g. a scheduled-activation
// runner over training_plan_activations_v2's pending/effective_at rows, must not crash on one
// either). Without the `deleted_at is null` guard below, this update would match a tombstoned
// plan's still-existing row and try to set status='active' while deleted_at stays set,
// violating training_plans_v2_deleted_requires_archived_check (20260731130000) with a hard DB
// error instead of the harmless no-op a fully removed row used to produce.
export async function applyPlanActivation(
  client: Client, userId: string, planId: string, currentRevisionId: string, reactivation: boolean,
): Promise<void> {
  await client.query(`update public.training_plans_v2
    set status='archived',archived_at=now(),version=version+1
    where user_id=$1 and status='active' and id<>$2`, [userId, planId]);
  await client.query(`update public.training_plan_activations_v2
    set status='cancelled',cancelled_at=now()
    where user_id=$1 and plan_id=$2 and status='pending'`, [userId, planId]);
  const activated = await client.query(`update public.training_plans_v2
    set status='active',activated_at=now(),archived_at=null,version=version+1
    where id=$1 and user_id=$2 and deleted_at is null`, [planId, userId]);
  // A tombstoned plan must also never gain a cycle state: resetCycle would otherwise INSERT a
  // fresh training_plan_cycle_states_v2 row for it (delete() already removed any prior one),
  // silently undoing exactly the cleanup delete() did, even though the plan itself was never
  // actually activated above.
  if (activated.rowCount === 0) return;
  await resetCycle(client, userId, planId, currentRevisionId,
    reactivation ? 'plan_reactivated' : 'plan_activated');
}

async function resetCycle(
  client: Client, userId: string, planId: string, revisionId: string,
  trigger: 'plan_activated' | 'plan_reactivated',
) {
  const first = await client.query<{ id: string; order_index: number }>(`
    select id,order_index from public.training_plan_units_v2
    where revision_id=$1 and plan_id=$2 and user_id=$3 order by order_index limit 1
  `, [revisionId, planId, userId]);
  if (!first.rows[0]) throw new Error('Training plan has no unit.');
  await client.query(`
    insert into public.training_plan_cycle_states_v2
      (plan_id,user_id,revision_id,next_unit_id,next_order_index,last_trigger,version,advanced_at)
    values ($1,$2,$3,$4,$5,$6,1,now())
    on conflict(plan_id) do update set
      user_id=excluded.user_id,revision_id=excluded.revision_id,next_unit_id=excluded.next_unit_id,
      next_order_index=excluded.next_order_index,last_trigger=excluded.last_trigger,
      version=public.training_plan_cycle_states_v2.version+1,advanced_at=now(),
      last_completed_session_at=null
  `, [planId, userId, revisionId, first.rows[0].id, first.rows[0].order_index, trigger]);
}

async function loadPlan(db: Pick<pg.Pool | Client, 'query'>, userId: string, planId: string): Promise<TrainingPlan | null> {
  const plans = await db.query<PlanRow>(`${planSummarySelect}
    where plan.user_id=$1 and plan.id=$2 and plan.deleted_at is null
      and plan.current_revision_id is not null`, [userId, planId]);
  const plan = plans.rows[0];
  if (!plan?.current_revision_id) return null;
  const revisions = await db.query<{
    id: string; revision_number: number; created_at: Date | string;
    source_template_revision_id: string | null;
  }>(`
    select id,revision_number,created_at,source_template_revision_id from public.training_plan_revisions_v2
    where id=$1 and plan_id=$2 and user_id=$3
  `, [plan.current_revision_id, planId, userId]);
  const revision = revisions.rows[0];
  if (!revision) return null;
  const units = await db.query<{
    id: string; logical_unit_key: string; name: string;
    unit_type: TrainingPlan['revision']['units'][number]['unitType']; order_index: number;
  }>(`select id,logical_unit_key,name,unit_type,order_index from public.training_plan_units_v2
      where revision_id=$1 and plan_id=$2 and user_id=$3 order by order_index`,
  [revision.id, planId, userId]);
  const targetExercises = await db.query<{
    id: string; unit_id: string; logical_target_exercise_key: string;
    exercise_id: string; order_index: number; note: string | null;
  }>(`select id,unit_id,logical_target_exercise_key,exercise_id,order_index,note
      from public.training_plan_exercises_v2
      where revision_id=$1 and plan_id=$2 and user_id=$3 order by unit_id,order_index`,
  [revision.id, planId, userId]);
  const targetSets = await db.query<{
    id: string; target_exercise_id: string; logical_target_set_key: string; order_index: number;
    set_type: 'warmup' | 'work' | 'drop'; target_weight_kg: string | number | null;
    target_reps_min: number | null; target_reps_max: number | null; target_rir: number | null;
    planned_rest_seconds: number; imported_from_legacy_plan: boolean;
  }>(`select id,target_exercise_id,logical_target_set_key,order_index,set_type,target_weight_kg,
        target_reps_min,target_reps_max,target_rir,planned_rest_seconds,imported_from_legacy_plan
      from public.training_plan_target_sets_v2
      where revision_id=$1 and plan_id=$2 and user_id=$3 order by target_exercise_id,order_index`,
  [revision.id, planId, userId]);
  const parsed = trainingPlanSchema.safeParse({
    ...mapTrainingPlanSummary(plan),
    revision: {
      id: String(revision.id), revisionNumber: Number(revision.revision_number),
      createdAt: iso(revision.created_at),
      sourceTemplateRevisionId: revision.source_template_revision_id === null
        ? null : String(revision.source_template_revision_id),
      units: units.rows.map((unit) => ({
        id: String(unit.id), logicalUnitKey: String(unit.logical_unit_key), name: String(unit.name),
        unitType: unit.unit_type, orderIndex: Number(unit.order_index),
        exercises: targetExercises.rows.filter((item) => item.unit_id === unit.id).map((item) => ({
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
            importedFromLegacyPlan: Boolean(set.imported_from_legacy_plan),
          })),
        })),
      })),
    },
  });
  if (!parsed.success) {
    const error = new Error('Internal training plan contract violation.');
    error.name = 'TrainingPlanContractError';
    throw error;
  }
  return parsed.data;
}

export function createTrainingPlanRepository(db: Database = getPgPool()): TrainingPlanRepository {
  return {
    async list(userId) {
      const result = await db.query<PlanRow>(`${planSummarySelect}
        where plan.user_id=$1 and plan.deleted_at is null
          and plan.status in ('active','scheduled','draft','archived')
        order by case plan.status
          when 'active' then 0 when 'scheduled' then 1 when 'draft' then 2 else 3 end,
          case when plan.status='scheduled' then schedule.effective_at end asc,
          case when plan.status<>'scheduled' then plan.updated_at end desc,
          plan.id asc`, [userId]);
      return result.rows.map(mapTrainingPlanSummary);
    },
    find(userId, planId) { return loadPlan(db, userId, planId); },
    create(userId, input) {
      return transaction(db, async (client) => {
        let reservedPlanId: string | null = null;
        if (input.idempotencyKey) {
          const fingerprint = fingerprintTrainingPlanCreate(input);
          // Unique(owner,key) waits for a concurrent winner to commit/roll back.
          // The deferred FK lets this reservation and the complete plan commit atomically.
          const claimed = await client.query<{ plan_id: string }>(`
            insert into public.training_plan_create_requests_v2(user_id,idempotency_key,request_fingerprint)
            values ($1,$2,$3) on conflict (user_id,idempotency_key) do nothing returning plan_id
          `, [userId, input.idempotencyKey, fingerprint]);
          if (!claimed.rows[0]) {
            const previous = await client.query<{ plan_id: string; request_fingerprint: string }>(`
              select plan_id,request_fingerprint from public.training_plan_create_requests_v2
              where user_id=$1 and idempotency_key=$2`, [userId, input.idempotencyKey]);
            const existing = previous.rows[0];
            if (!existing || existing.request_fingerprint !== fingerprint) throw new TrainingPlanCreateConflictError();
            return String(existing.plan_id);
          }
          reservedPlanId = String(claimed.rows[0].plan_id);
        }
        if (input.activateImmediately) {
          await client.query(`update public.training_plans_v2
            set status='archived',archived_at=now(),version=version+1
            where user_id=$1 and status='active'`, [userId]);
        }
        const plans = await client.query<{ id: string }>(`
          insert into public.training_plans_v2(user_id,name,status,activated_at,id)
          values ($1,$2,$3,case when $3='active' then now() else null end,coalesce($4::uuid,gen_random_uuid())) returning id
        `, [userId, input.name, input.activateImmediately ? 'active' : 'draft', reservedPlanId]);
        const planId = String(plans.rows[0].id);
        const tree = await insertTree(client, userId, planId, 1, input);
        await client.query(`update public.training_plans_v2 set current_revision_id=$1
          where id=$2 and user_id=$3`, [tree.revisionId, planId, userId]);
        await client.query(`insert into public.training_weekly_goal_versions_v2
          (plan_id,user_id,target_sessions_per_week,effective_from) values ($1,$2,$3,now())`,
        [planId, userId, input.weeklyGoal]);
        if (input.activateImmediately) {
          await resetCycle(client, userId, planId, tree.revisionId, 'plan_activated');
        }
        return planId;
      });
    },
    update(userId, planId, input) {
      return transaction(db, async (client): Promise<MutationResult> => {
        // Lock the plan row on its own first (audit F09). With the revision joined into the
        // locking query, a PATCH that waited for a concurrent PATCH was re-checked by PostgreSQL
        // against the plan's NEW current_revision_id but the OLD joined revision row, matched
        // nothing and surfaced as 404. Locking alone keeps 404 strictly for "missing, deleted or
        // not yours" (the owner filter is unchanged) and lets a stale version become a 409.
        const lockedRows = await client.query<{
          version: number; current_revision_id: string | null; source_template_id: string | null;
        }>(`select plan.version,plan.current_revision_id,plan.source_template_id
            from public.training_plans_v2 plan
            where plan.id=$1 and plan.user_id=$2 and plan.deleted_at is null
            for update of plan`, [planId, userId]);
        const locked = lockedRows.rows[0];
        if (!locked?.current_revision_id) return { outcome: 'not_found' };
        if (locked.source_template_id != null) return { outcome: 'status_conflict' };
        if (Number(locked.version) !== input.expectedVersion) return { outcome: 'version_conflict' };
        const revisionRows = await client.query<{
          revision_number: number; source_template_revision_id: string | null;
        }>(`select revision_number,source_template_revision_id from public.training_plan_revisions_v2
            where id=$1 and plan_id=$2 and user_id=$3`, [locked.current_revision_id, planId, userId]);
        if (!revisionRows.rows[0]) return { outcome: 'not_found' };
        const current = { ...locked, current_revision_id: locked.current_revision_id, ...revisionRows.rows[0] };
        const cycleRows = await client.query<{ logical_unit_key: string; order_index: number }>(`
          select unit.logical_unit_key,unit.order_index from public.training_plan_cycle_states_v2 cycle
          join public.training_plan_units_v2 unit on unit.id=cycle.next_unit_id
            and unit.revision_id=cycle.revision_id and unit.plan_id=cycle.plan_id
            and unit.user_id=cycle.user_id where cycle.plan_id=$1 and cycle.user_id=$2`,
        [planId, userId]);
        const oldUnits = await client.query<{ logical_unit_key: string; order_index: number }>(`
          select logical_unit_key,order_index from public.training_plan_units_v2
          where revision_id=$1 and plan_id=$2 and user_id=$3 order by order_index`,
        [current.current_revision_id, planId, userId]);
        const tree = await insertTree(
          client, userId, planId, Number(current.revision_number) + 1, input,
          current.source_template_revision_id,
        );
        await client.query(`update public.training_plans_v2
          set name=$1,current_revision_id=$2,version=version+1 where id=$3 and user_id=$4`,
        [input.name, tree.revisionId, planId, userId]);
        if (cycleRows.rows[0]) {
          const cycle = cycleRows.rows[0];
          let next = tree.units.find((unit) => unit.logicalKey === cycle.logical_unit_key);
          if (!next) {
            const followingKeys = oldUnits.rows.filter((unit) => unit.order_index > cycle.order_index)
              .map((unit) => unit.logical_unit_key);
            next = followingKeys.map((key) => tree.units.find((unit) => unit.logicalKey === key))
              .find((unit) => unit !== undefined) ?? tree.units[0];
          }
          await client.query(`update public.training_plan_cycle_states_v2
            set revision_id=$1,next_unit_id=$2,next_order_index=$3,last_trigger='plan_revision_remapped',
              version=version+1,advanced_at=now() where plan_id=$4 and user_id=$5`,
          [tree.revisionId, next.id, next.orderIndex, planId, userId]);
        }
        return { outcome: 'ok', planId };
      });
    },
    activate(userId, planId, expectedVersion, reactivation) {
      return transaction(db, async (client): Promise<MutationResult> => {
        const rows = await client.query<{ version: number; status: string; current_revision_id: string | null }>(`
          select version,status,current_revision_id from public.training_plans_v2
          where id=$1 and user_id=$2 and deleted_at is null for update`, [planId, userId]);
        const plan = rows.rows[0];
        if (!plan) return { outcome: 'not_found' };
        if (Number(plan.version) !== expectedVersion) return { outcome: 'version_conflict' };
        if (
          !plan.current_revision_id
          || (reactivation
            ? plan.status !== 'archived'
            : plan.status !== 'draft' && plan.status !== 'scheduled')
        ) {
          return { outcome: 'status_conflict' };
        }
        await applyPlanActivation(client, userId, planId, plan.current_revision_id, reactivation);
        return { outcome: 'ok', planId };
      });
    },
    schedule(userId, planId, expectedVersion, startDate, effectiveAt, timeZone) {
      return transaction(db, async (client): Promise<MutationResult> => {
        const rows = await client.query<{ version: number; status: string; current_revision_id: string | null }>(`
          select version,status,current_revision_id from public.training_plans_v2
          where id=$1 and user_id=$2 and deleted_at is null for update`, [planId, userId]);
        const plan = rows.rows[0];
        if (!plan) return { outcome: 'not_found' };
        if (Number(plan.version) !== expectedVersion) return { outcome: 'version_conflict' };
        if (!plan.current_revision_id || plan.status === 'active') return { outcome: 'status_conflict' };
        const scheduled = await client.query(`select id from public.training_plans_v2
          where user_id=$1 and status='scheduled' and id<>$2 limit 1`, [userId, planId]);
        if (scheduled.rows[0]) return { outcome: 'schedule_conflict' };
        await client.query(`update public.training_plan_activations_v2
          set status='cancelled',cancelled_at=now()
          where user_id=$1 and plan_id=$2 and status='pending'`, [userId, planId]);
        await client.query(`update public.training_plans_v2
          set status='scheduled',archived_at=null,version=version+1 where id=$1 and user_id=$2`,
        [planId, userId]);
        await client.query(`insert into public.training_plan_activations_v2
          (plan_id,revision_id,user_id,start_date,effective_at,timezone,status,expected_plan_version)
          values ($1,$2,$3,$4,$5,$6,'pending',$7)`,
        [planId, plan.current_revision_id, userId, startDate, effectiveAt, timeZone, expectedVersion + 1]);
        return { outcome: 'ok', planId };
      });
    },
    archive(userId, planId, expectedVersion) {
      return transaction(db, async (client): Promise<MutationResult> => {
        const rows = await client.query<{ version: number; status: string }>(`
          select version,status from public.training_plans_v2
          where id=$1 and user_id=$2 and deleted_at is null for update`,
        [planId, userId]);
        const plan = rows.rows[0];
        if (!plan) return { outcome: 'not_found' };
        if (Number(plan.version) !== expectedVersion) return { outcome: 'version_conflict' };
        if (plan.status === 'active' || plan.status === 'archived') return { outcome: 'status_conflict' };
        await client.query(`update public.training_plan_activations_v2
          set status='cancelled',cancelled_at=now()
          where plan_id=$1 and user_id=$2 and status='pending'`, [planId, userId]);
        await client.query(`update public.training_plans_v2
          set status='archived',archived_at=now(),version=version+1 where id=$1 and user_id=$2`,
        [planId, userId]);
        return { outcome: 'ok', planId };
      });
    },
    updateWeeklyGoal(userId, planId, expectedVersion, weeklyGoal) {
      return transaction(db, async (client): Promise<MutationResult> => {
        const rows = await client.query<{ version: number }>(`
          select version from public.training_plans_v2
          where id=$1 and user_id=$2 and deleted_at is null for update`,
        [planId, userId]);
        if (!rows.rows[0]) return { outcome: 'not_found' };
        if (Number(rows.rows[0].version) !== expectedVersion) return { outcome: 'version_conflict' };
        await client.query(`insert into public.training_weekly_goal_versions_v2
          (plan_id,user_id,target_sessions_per_week,effective_from)
          values ($1,$2,$3,clock_timestamp())`, [planId, userId, weeklyGoal]);
        await client.query(`update public.training_plans_v2 set version=version+1
          where id=$1 and user_id=$2`, [planId, userId]);
        return { outcome: 'ok', planId };
      });
    },
    // Tombstones rather than physically removing the row (see
    // 20260731130000_training_v2_plan_tombstones.sql): `deleted_at` is set and the plan is
    // moved into the existing 'archived' status (never a new status value), which — like
    // archive() — leaves no plan active or scheduled afterward without ever promoting another
    // one. The plan's own row and its entire immutable revision tree (revisions, units,
    // exercises, target sets) are left fully intact; only the pending activation (if any) is
    // cancelled and the cycle state is removed outright, exactly the two pieces of *live*
    // plan-progression state that must not silently keep advancing for a plan the user has
    // deleted. Every other read/mutation in this file excludes `deleted_at is not null`, so a
    // tombstoned plan is `not_found` everywhere else — except Training V2 sessions
    // (trainingSessionRepository.ts), which deliberately carry no such filter: they read
    // straight through a tombstoned plan and its revisions to keep building a session's
    // historical snapshot, which is the entire point of not hard-deleting here. Only a true
    // account/owner cascade (an auth.users row deletion) still physically removes everything,
    // via the unchanged `on delete cascade` FK chain.
    //
    // Scoping by user_id in the same statement is both the ownership check and the delete: a
    // foreign plan id matches zero rows and comes back as `not_found`, exactly like every
    // other mutation in this file. source_template_id is not null excludes every Grow
    // instance — saved, unsaved or active — from this path entirely: they are only ever
    // created/removed via the template save/unsave/activate flow
    // (trainingTemplateSaveRepository.ts), never tombstoned here, so a Grow-sourced plan id
    // here matches zero rows and comes back as `not_found` exactly like a foreign or
    // already-deleted plan id, never partially applying or otherwise touching that row.
    delete(userId, planId) {
      return transaction(db, async (client): Promise<MutationResult> => {
        const rows = await client.query<{ id: string }>(`
          select id from public.training_plans_v2
          where id=$1 and user_id=$2 and source_template_id is null and deleted_at is null
          for update`, [planId, userId]);
        if (!rows.rows[0]) return { outcome: 'not_found' };
        await client.query(`update public.training_plan_activations_v2
          set status='cancelled',cancelled_at=now()
          where plan_id=$1 and user_id=$2 and status='pending'`, [planId, userId]);
        await client.query(`delete from public.training_plan_cycle_states_v2
          where plan_id=$1 and user_id=$2`, [planId, userId]);
        await client.query(`update public.training_plans_v2
          set status='archived',archived_at=now(),deleted_at=now(),version=version+1
          where id=$1 and user_id=$2`, [planId, userId]);
        return { outcome: 'ok', planId };
      });
    },
  };
}
