import type {
  CreateTrainingSessionInput,
  ListTrainingSessionsQuery,
  TrainingSession,
  TrainingSessionSummary,
} from '@grow/shared/src/training/sessions.js';
import { trainingSessionSchema, trainingSessionSummarySchema } from '@grow/shared/src/training/sessions.js';
import type pg from 'pg';
import { getPgPool } from '../../db/client.js';
import { transaction, type Client, type Database } from '../trainingPlans/trainingPlanRepository.js';
import { computeSessionRequestFingerprint } from './trainingSessionFingerprint.js';
import { remapUnitAcrossRevisions, type CycleRemapUnit } from './trainingSessionCycleRemap.js';

export type CreateSessionResult =
  | { outcome: 'ok'; session: TrainingSession; created: boolean }
  | { outcome: 'conflict' }
  | { outcome: 'plan_not_found' }
  | { outcome: 'unit_not_found' }
  | { outcome: 'reference_not_available' };

export type TrainingSessionRepository = {
  create(userId: string, input: CreateTrainingSessionInput): Promise<CreateSessionResult>;
  findLastExerciseNote(userId: string, exerciseId: string): Promise<{ note: string; completedAt: string } | null>;
  list(
    userId: string,
    query: ListTrainingSessionsQuery,
  ): Promise<{ sessions: TrainingSessionSummary[]; hasMore: boolean }>;
  find(userId: string, sessionId: string): Promise<TrainingSession | null>;
};

type SessionRow = {
  id: string; plan_id: string | null; plan_revision_id: string | null; source_unit_id: string | null;
  plan_name: string; revision_number: number; logical_unit_key: string; unit_name: string;
  unit_type: TrainingSession['unitType']; status: TrainingSession['status']; idempotency_key: string;
  started_at: Date | string | null; ended_at: Date | string | null; paused_duration_seconds: number;
  created_at: Date | string;
};
type SessionExerciseRow = {
  id: string; exercise_id: string; exercise_name: string; exercise_main_muscle: string | null;
  logical_target_exercise_key: string | null; order_index: number; note: string | null;
};
type SessionSetRow = {
  id: string; session_exercise_id: string; client_set_id: string; logical_target_set_key: string | null;
  order_index: number; set_type: 'warmup' | 'work' | 'drop'; weight_kg: string | number | null;
  reps: number | null; rir: number | null; note: string | null; completed_at: Date | string;
  actual_rest_seconds: number | null; version: number;
};

const iso = (value: Date | string) => new Date(value).toISOString();
const isoOrNull = (value: Date | string | null) => (value === null ? null : iso(value));

async function loadSession(
  db: Pick<pg.Pool | Client, 'query'>, userId: string, sessionId: string,
): Promise<TrainingSession | null> {
  const sessions = await db.query<SessionRow>(`
    select id,plan_id,plan_revision_id,source_unit_id,plan_name,revision_number,logical_unit_key,
      unit_name,unit_type,status,idempotency_key,started_at,ended_at,paused_duration_seconds,created_at
    from public.training_sessions_v2 where id=$1 and user_id=$2`, [sessionId, userId]);
  const session = sessions.rows[0];
  if (!session) return null;
  const exercises = await db.query<SessionExerciseRow>(`
    select id,exercise_id,exercise_name,exercise_main_muscle,logical_target_exercise_key,order_index,note
    from public.training_session_exercises_v2 where session_id=$1 and user_id=$2 order by order_index`,
  [sessionId, userId]);
  const sets = await db.query<SessionSetRow>(`
    select id,session_exercise_id,client_set_id,logical_target_set_key,order_index,set_type,weight_kg,
      reps,rir,note,completed_at,actual_rest_seconds,version
    from public.training_session_sets_v2 where session_id=$1 and user_id=$2 order by session_exercise_id,order_index`,
  [sessionId, userId]);

  const parsed = trainingSessionSchema.safeParse({
    id: String(session.id),
    planId: session.plan_id === null ? null : String(session.plan_id),
    planRevisionId: session.plan_revision_id === null ? null : String(session.plan_revision_id),
    sourceUnitId: session.source_unit_id === null ? null : String(session.source_unit_id),
    planName: String(session.plan_name),
    revisionNumber: Number(session.revision_number),
    logicalUnitKey: String(session.logical_unit_key),
    unitName: String(session.unit_name),
    unitType: session.unit_type,
    status: session.status,
    idempotencyKey: String(session.idempotency_key),
    startedAt: isoOrNull(session.started_at),
    endedAt: isoOrNull(session.ended_at),
    pausedDurationSeconds: Number(session.paused_duration_seconds),
    createdAt: iso(session.created_at),
    exercises: exercises.rows.map((exercise) => ({
      id: String(exercise.id),
      exerciseId: String(exercise.exercise_id),
      exerciseName: String(exercise.exercise_name),
      exerciseMainMuscle: exercise.exercise_main_muscle,
      logicalTargetExerciseKey: exercise.logical_target_exercise_key === null
        ? null : String(exercise.logical_target_exercise_key),
      orderIndex: Number(exercise.order_index),
      note: exercise.note,
      sets: sets.rows.filter((set) => String(set.session_exercise_id) === String(exercise.id)).map((set) => ({
        id: String(set.id),
        clientSetId: String(set.client_set_id),
        logicalTargetSetKey: set.logical_target_set_key === null ? null : String(set.logical_target_set_key),
        orderIndex: Number(set.order_index),
        setType: set.set_type,
        weightKg: set.weight_kg === null ? null : Number(set.weight_kg),
        reps: set.reps === null ? null : Number(set.reps),
        rir: set.rir === null ? null : Number(set.rir),
        note: set.note,
        completedAt: iso(set.completed_at),
        actualRestSeconds: set.actual_rest_seconds === null ? null : Number(set.actual_rest_seconds),
        version: Number(set.version),
      })),
    })),
  });
  if (!parsed.success) {
    const error = new Error('Internal training session contract violation.');
    error.name = 'TrainingSessionContractError';
    throw error;
  }
  return parsed.data;
}

function mapSessionSummaryRow(row: SessionRow): TrainingSessionSummary {
  const parsed = trainingSessionSummarySchema.safeParse({
    id: String(row.id),
    planId: row.plan_id === null ? null : String(row.plan_id),
    planRevisionId: row.plan_revision_id === null ? null : String(row.plan_revision_id),
    sourceUnitId: row.source_unit_id === null ? null : String(row.source_unit_id),
    planName: String(row.plan_name),
    revisionNumber: Number(row.revision_number),
    logicalUnitKey: String(row.logical_unit_key),
    unitName: String(row.unit_name),
    unitType: row.unit_type,
    status: row.status,
    idempotencyKey: String(row.idempotency_key),
    startedAt: isoOrNull(row.started_at),
    endedAt: isoOrNull(row.ended_at),
    pausedDurationSeconds: Number(row.paused_duration_seconds),
    createdAt: iso(row.created_at),
  });
  if (!parsed.success) {
    const error = new Error('Internal training session contract violation.');
    error.name = 'TrainingSessionContractError';
    throw error;
  }
  return parsed.data;
}

// Owner-scoped only -- deliberately no join/filter on plan status or deleted_at (see the
// plan-tombstones migration's own comment): a session must keep listing exactly as it always
// has even after its source plan is edited, archived or deleted. Rides
// training_sessions_v2_user_created_at_idx (user_id, created_at desc); `id desc` is only a
// deterministic tiebreaker for rows sharing a created_at timestamp.
async function listSessions(
  db: Pick<pg.Pool, 'query'>, userId: string, query: ListTrainingSessionsQuery,
): Promise<{ sessions: TrainingSessionSummary[]; hasMore: boolean }> {
  const result = await db.query<SessionRow>(`
    select id,plan_id,plan_revision_id,source_unit_id,plan_name,revision_number,logical_unit_key,
      unit_name,unit_type,status,idempotency_key,started_at,ended_at,paused_duration_seconds,created_at
    from public.training_sessions_v2
    where user_id=$1
    order by created_at desc, id desc
    limit $2 offset $3
  `, [userId, query.limit + 1, query.page * query.limit]);
  return {
    sessions: result.rows.slice(0, query.limit).map(mapSessionSummaryRow),
    hasMore: result.rows.length > query.limit,
  };
}

async function findSessionByIdempotencyKey(
  client: Client, userId: string, idempotencyKey: string,
): Promise<{ id: string; fingerprint: string } | null> {
  const result = await client.query<{ id: string; request_fingerprint: string }>(`
    select id,request_fingerprint from public.training_sessions_v2
    where user_id=$1 and idempotency_key=$2`, [userId, idempotencyKey]);
  const row = result.rows[0];
  return row ? { id: String(row.id), fingerprint: String(row.request_fingerprint) } : null;
}

// Scoped by exerciseId (the stable catalog identity), not logicalTargetExerciseKey (which is
// per-plan/per-unit) -- "the same exercise" must mean the same movement regardless of which
// plan or unit it was logged under, and regardless of whether that plan/unit still exists (a
// session's own exercise_id survives even the on-delete-set-null of its plan backlinks). Reads
// training_session_exercises_v2.note directly (the exercise-level note the user typed that
// session), not any per-set note -- e.created_at stands in for "completedAt" here since the
// exercise row itself carries no completion timestamp of its own.
async function findLastExerciseNote(
  db: Pick<pg.Pool, 'query'>, userId: string, exerciseId: string,
): Promise<{ note: string; completedAt: string } | null> {
  const result = await db.query<{ note: string; created_at: Date | string }>(`
    select e.note, e.created_at
    from public.training_session_exercises_v2 e
    where e.user_id = $1 and e.exercise_id = $2
      and e.note is not null and length(trim(e.note)) > 0
    order by e.created_at desc
    limit 1
  `, [userId, exerciseId]);
  const row = result.rows[0];
  return row ? { note: row.note, completedAt: iso(row.created_at) } : null;
}

export function createTrainingSessionRepository(db: Database = getPgPool()): TrainingSessionRepository {
  return {
    findLastExerciseNote(userId, exerciseId) {
      return findLastExerciseNote(db, userId, exerciseId);
    },
    list(userId, query) {
      return listSessions(db, userId, query);
    },
    find(userId, sessionId) {
      return loadSession(db, userId, sessionId);
    },
    create(userId, input) {
      const fingerprint = computeSessionRequestFingerprint(input);
      return transaction(db, async (client): Promise<CreateSessionResult> => {
        // An idempotent replay is checked before any plan/unit validation and short-circuits
        // entirely: it must keep returning the original historical record even if the source
        // plan or unit has since been edited, archived or hard-deleted (see the on-delete-set-
        // null design in the session-core migration) -- validation only ever applies to a
        // genuinely new key. A matching fingerprint returns the existing record; a differing
        // one under the same key is a real conflict, not a silent overwrite or a fresh insert.
        const existing = await findSessionByIdempotencyKey(client, userId, input.idempotencyKey);
        if (existing) {
          if (existing.fingerprint !== fingerprint) return { outcome: 'conflict' };
          const session = await loadSession(client, userId, existing.id);
          if (!session) throw new Error('Training session vanished after idempotency lookup.');
          return { outcome: 'ok', session, created: false };
        }

        // Ownership only -- ***not*** plan.status or plan.current_revision_id: a session
        // that was started locally against some revision must stay historically storable
        // even if the plan's status or current revision has since moved on (edited,
        // scheduled, archived, reactivated...). The `for update` lock still serializes
        // against a concurrent plan mutation reading a torn current_revision_id below.
        const planRows = await client.query<{ name: string }>(`
          select name from public.training_plans_v2 where id=$1 and user_id=$2 for update`,
        [input.planId, userId]);
        const plan = planRows.rows[0];
        if (!plan) return { outcome: 'plan_not_found' };

        // The unit is looked up directly by id, not scoped to the plan's *current* revision:
        // its own (immutable) revision_id is the source of truth for what was actually
        // performed, exactly the "immutable Quellrevision" this save must honor.
        const sourceUnitRows = await client.query<{
          id: string; revision_id: string; order_index: number; logical_unit_key: string; name: string; unit_type: string;
        }>(`
          select id,revision_id,order_index,logical_unit_key,name,unit_type from public.training_plan_units_v2
          where id=$1 and plan_id=$2 and user_id=$3`, [input.unitId, input.planId, userId]);
        const sourceUnit = sourceUnitRows.rows[0];
        if (!sourceUnit) return { outcome: 'unit_not_found' };

        const revisionRows = await client.query<{ revision_number: number }>(`
          select revision_number from public.training_plan_revisions_v2
          where id=$1 and plan_id=$2 and user_id=$3`, [sourceUnit.revision_id, input.planId, userId]);
        const revision = revisionRows.rows[0];
        if (!revision) return { outcome: 'unit_not_found' };

        const siblingUnitsResult = await client.query<{
          id: string; order_index: number; logical_unit_key: string;
        }>(`
          select id,order_index,logical_unit_key from public.training_plan_units_v2
          where revision_id=$1 and plan_id=$2 and user_id=$3 order by order_index`,
        [sourceUnit.revision_id, input.planId, userId]);
        const siblingUnits = siblingUnitsResult.rows;
        const unitIndex = siblingUnits.findIndex((row) => String(row.id) === String(sourceUnit.id));

        const planExercisesResult = await client.query<{
          id: string; logical_target_exercise_key: string;
        }>(`
          select id,logical_target_exercise_key from public.training_plan_exercises_v2
          where unit_id=$1 and revision_id=$2 and plan_id=$3 and user_id=$4`,
        [sourceUnit.id, sourceUnit.revision_id, input.planId, userId]);
        const planExercisesByKey = new Map(
          planExercisesResult.rows.map((row) => [String(row.logical_target_exercise_key), row]),
        );

        const planTargetSetsResult = await client.query<{ target_exercise_id: string; logical_target_set_key: string }>(`
          select target_exercise_id,logical_target_set_key from public.training_plan_target_sets_v2
          where unit_id=$1 and revision_id=$2 and plan_id=$3 and user_id=$4`,
        [sourceUnit.id, sourceUnit.revision_id, input.planId, userId]);
        const targetSetKeysByExercise = new Map<string, Set<string>>();
        for (const row of planTargetSetsResult.rows) {
          const key = String(row.target_exercise_id);
          if (!targetSetKeysByExercise.has(key)) targetSetKeysByExercise.set(key, new Set());
          targetSetKeysByExercise.get(key)!.add(String(row.logical_target_set_key));
        }

        const requestedExerciseIds = [...new Set(input.exercises.map((exercise) => exercise.exerciseId))];
        const catalogResult = requestedExerciseIds.length === 0
          ? { rows: [] as { id: string; name: string; main_muscle: string | null }[] }
          : await client.query<{ id: string; name: string; main_muscle: string | null }>(`
            select id,name,main_muscle from public.training_exercises_v2
            where id=any($1::uuid[]) and status='active'
              and ((scope='system' and owner_user_id is null) or (scope='user' and owner_user_id=$2))`,
          [requestedExerciseIds, userId]);
        const catalogById = new Map(catalogResult.rows.map((row) => [String(row.id), row]));

        const resolvedExercises: Array<{
          input: typeof input.exercises[number];
          catalog: { id: string; name: string; main_muscle: string | null };
          planExercise: { id: string } | null;
        }> = [];
        for (const exerciseInput of input.exercises) {
          const catalog = catalogById.get(exerciseInput.exerciseId);
          if (!catalog) return { outcome: 'reference_not_available' };
          let planExercise: { id: string } | null = null;
          if (exerciseInput.logicalTargetExerciseKey !== null) {
            const matched = planExercisesByKey.get(exerciseInput.logicalTargetExerciseKey);
            if (!matched) return { outcome: 'reference_not_available' };
            const allowedSetKeys = targetSetKeysByExercise.get(matched.id) ?? new Set<string>();
            for (const setInput of exerciseInput.sets) {
              if (setInput.logicalTargetSetKey !== null && !allowedSetKeys.has(setInput.logicalTargetSetKey)) {
                return { outcome: 'reference_not_available' };
              }
            }
            planExercise = matched;
          }
          resolvedExercises.push({ input: exerciseInput, catalog, planExercise });
        }

        const sessionInsert = await client.query<{ id: string }>(`
          insert into public.training_sessions_v2
            (user_id,plan_id,plan_revision_id,source_unit_id,plan_name,revision_number,
             logical_unit_key,unit_name,unit_type,status,idempotency_key,started_at,ended_at,
             paused_duration_seconds,request_fingerprint)
          values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
          on conflict (user_id,idempotency_key) do nothing
          returning id
        `, [
          userId, input.planId, sourceUnit.revision_id, sourceUnit.id, plan.name, revision.revision_number,
          sourceUnit.logical_unit_key, sourceUnit.name, sourceUnit.unit_type, input.status, input.idempotencyKey,
          input.startedAt, input.endedAt, input.pausedDurationSeconds, fingerprint,
        ]);

        if (!sessionInsert.rows[0]) {
          // Lost a create race against a concurrent request using the exact same idempotency
          // key (both passed the up-front existence check before either committed) -- the
          // winner's row exists now; reuse it exactly like the up-front check would have,
          // including the fingerprint comparison.
          const raced = await findSessionByIdempotencyKey(client, userId, input.idempotencyKey);
          if (!raced) throw new Error('Training session vanished after a concurrent-insert race.');
          if (raced.fingerprint !== fingerprint) return { outcome: 'conflict' };
          const session = await loadSession(client, userId, raced.id);
          if (!session) throw new Error('Training session vanished after a concurrent-insert race.');
          return { outcome: 'ok', session, created: false };
        }
        const sessionId = String(sessionInsert.rows[0].id);

        for (const resolved of [...resolvedExercises].sort((a, b) => a.input.orderIndex - b.input.orderIndex)) {
          const exerciseRow = await client.query<{ id: string }>(`
            insert into public.training_session_exercises_v2
              (session_id,user_id,exercise_id,exercise_name,exercise_main_muscle,
               source_target_exercise_id,logical_target_exercise_key,order_index,note)
            values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id
          `, [
            sessionId, userId, resolved.catalog.id, resolved.catalog.name, resolved.catalog.main_muscle,
            resolved.planExercise?.id ?? null, resolved.input.logicalTargetExerciseKey, resolved.input.orderIndex,
            resolved.input.note,
          ]);
          const sessionExerciseId = String(exerciseRow.rows[0].id);

          for (const setInput of [...resolved.input.sets].sort((a, b) => a.orderIndex - b.orderIndex)) {
            await client.query(`
              insert into public.training_session_sets_v2
                (session_exercise_id,session_id,user_id,client_set_id,logical_target_set_key,order_index,
                 set_type,weight_kg,reps,rir,note,completed_at,actual_rest_seconds)
              values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
            `, [
              sessionExerciseId, sessionId, userId, setInput.clientSetId, setInput.logicalTargetSetKey,
              setInput.orderIndex, setInput.setType, setInput.weightKg, setInput.reps, setInput.rir,
              setInput.note, setInput.completedAt, setInput.actualRestSeconds,
            ]);
          }
        }

        if (input.status === 'completed') {
          // The successor is computed within the session's own *source* revision (order_index
          // wrap-around, immediately after the completed unit) -- this is "the successor of
          // the actually performed unit", regardless of which revision the plan currently
          // points to. Only once that successor is known does it get remapped onto whatever
          // revision the plan's cycle state currently tracks, using the exact same
          // logical-key algorithm trainingPlanRepository.ts's update() already uses for a
          // plan edit (see trainingSessionCycleRemap.ts) -- never a new, invented mapping.
          const cycleRows = await client.query<{ revision_id: string }>(`
            select revision_id from public.training_plan_cycle_states_v2
            where plan_id=$1 and user_id=$2 for update`, [input.planId, userId]);
          const cycle = cycleRows.rows[0];
          // No cycle state exists at all (the plan was never activated) -- there is nothing
          // to advance; the session itself has already been fully saved above regardless.
          if (cycle) {
            const successor = siblingUnits[(unitIndex + 1) % siblingUnits.length];
            let target: CycleRemapUnit = {
              id: successor.id, orderIndex: Number(successor.order_index), logicalUnitKey: String(successor.logical_unit_key),
            };
            if (String(cycle.revision_id) !== String(sourceUnit.revision_id)) {
              const currentRevisionUnitsResult = await client.query<{
                id: string; order_index: number; logical_unit_key: string;
              }>(`
                select id,order_index,logical_unit_key from public.training_plan_units_v2
                where revision_id=$1 and plan_id=$2 and user_id=$3 order by order_index`,
              [cycle.revision_id, input.planId, userId]);
              const currentRevisionUnits: CycleRemapUnit[] = currentRevisionUnitsResult.rows.map((row) => ({
                id: String(row.id), orderIndex: Number(row.order_index), logicalUnitKey: String(row.logical_unit_key),
              }));
              const sourceRevisionUnits: CycleRemapUnit[] = siblingUnits.map((row) => ({
                id: String(row.id), orderIndex: Number(row.order_index), logicalUnitKey: String(row.logical_unit_key),
              }));
              target = remapUnitAcrossRevisions(sourceRevisionUnits, currentRevisionUnits, {
                orderIndex: target.orderIndex, logicalUnitKey: target.logicalUnitKey,
              });
            }
            await client.query(`
              update public.training_plan_cycle_states_v2
              set next_unit_id=$1,next_order_index=$2,last_trigger='session_completed',
                version=version+1,advanced_at=now()
              where plan_id=$3 and user_id=$4
            `, [target.id, target.orderIndex, input.planId, userId]);
          }
        }

        const session = await loadSession(client, userId, sessionId);
        if (!session) throw new Error('Training session vanished immediately after insert.');
        return { outcome: 'ok', session, created: true };
      });
    },
  };
}
