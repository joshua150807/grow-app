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

export function getTrainingV2HubRedirect({ plans, loading, error }) {
  if (loading || error || findActiveTrainingV2Plan(plans)) return null;
  return '/tools/training-v2-plans';
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
