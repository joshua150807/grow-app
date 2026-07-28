export const PLAN_STATUS_LABELS = {
  active: 'Active',
  scheduled: 'Scheduled',
  draft: 'Draft',
  archived: 'Archived',
};

export const UNIT_TYPE_LABELS = {
  strength: 'Kraft',
  run: 'Laufen',
  rest: 'Erholung',
};

export function groupTrainingV2Plans(plans) {
  return plans.reduce((groups, plan) => {
    groups[plan.status].push(plan);
    return groups;
  }, { active: [], scheduled: [], draft: [], archived: [] });
}

export function findActiveTrainingV2Plan(plans) {
  return plans.find((plan) => plan.status === 'active') ?? null;
}

// Mirrors the API's own status gates in trainingPlanRepository.ts exactly (activate:
// draft/scheduled only, schedule: anything but active, archive: anything but active/
// archived, reactivate: archived only) so the UI never offers an action the server
// would reject with a status conflict. Weekly-goal has no server-side status gate,
// but is deliberately curated to hide once a plan is archived.
export function getAvailableTrainingV2PlanActions(status) {
  switch (status) {
    case 'draft':
    case 'scheduled':
      return {
        canActivate: true, canSchedule: true, canArchive: true, canReactivate: false, canEditWeeklyGoal: true,
      };
    case 'active':
      return {
        canActivate: false, canSchedule: false, canArchive: false, canReactivate: false, canEditWeeklyGoal: true,
      };
    case 'archived':
      return {
        canActivate: false, canSchedule: false, canArchive: false, canReactivate: true, canEditWeeklyGoal: false,
      };
    default:
      return {
        canActivate: false, canSchedule: false, canArchive: false, canReactivate: false, canEditWeeklyGoal: false,
      };
  }
}

// A plan-action modal (schedule / weekly goal) closes on success, and also on a
// stale-version conflict — so the existing screen-level conflict banner and its
// "reload current server state" button become reachable again. Any other failure
// (400/404/network/contract, or a non-version 409 like another plan already being
// scheduled) keeps the modal open so its own in-modal error text stays visible and
// the user's input is preserved for a retry.
export function shouldClosePlanActionModal(outcome) {
  return outcome.ok === true || outcome.error?.code === 'TRAINING_PLAN_VERSION_CONFLICT';
}

export function mapTrainingV2PlanDetail(plan, exerciseNames) {
  return {
    ...plan,
    statusLabel: PLAN_STATUS_LABELS[plan.status],
    units: plan.revision.units.map((unit) => ({
      ...unit,
      unitTypeLabel: UNIT_TYPE_LABELS[unit.unitType],
      exercises: unit.exercises.map((exercise) => ({
        ...exercise,
        exerciseName: exerciseNames[exercise.exerciseId] ?? 'Unbekannte Übung',
      })),
    })),
  };
}

export function targetSetLabel(targetSet) {
  const parts = [];
  if (targetSet.targetReps) {
    parts.push(
      targetSet.targetReps.minimum === targetSet.targetReps.maximum
        ? `${targetSet.targetReps.minimum} Wdh.`
        : `${targetSet.targetReps.minimum}–${targetSet.targetReps.maximum} Wdh.`,
    );
  }
  if (targetSet.targetWeightKg !== null) parts.push(`${targetSet.targetWeightKg} kg`);
  if (targetSet.targetRir !== null) parts.push(`RIR ${targetSet.targetRir}`);
  if (targetSet.plannedRestSeconds !== null) parts.push(`${targetSet.plannedRestSeconds}s Pause`);
  return parts.length ? parts.join(' · ') : targetSet.setType;
}
