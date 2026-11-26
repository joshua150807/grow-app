export type CycleRemapUnit = { id: string; orderIndex: number; logicalUnitKey: string };

// Mirrors trainingPlanRepository.ts's update() cycle-remap block exactly (the only place this
// plan/cycle domain already resolves a unit anchored in a stale revision against a different
// one) -- reproduced here rather than imported, since this module must not touch
// trainingPlans code. Given a unit identified by (logicalUnitKey, orderIndex) inside a
// possibly-stale revision, resolves its best-effort equivalent inside a different revision of
// the same plan: the same logical key wins outright; otherwise the next later logical key (by
// the *old* revision's own order) that still exists in the new revision; otherwise the new
// revision's first unit (ordered by orderIndex).
export function remapUnitAcrossRevisions(
  oldRevisionUnits: CycleRemapUnit[],
  newRevisionUnits: CycleRemapUnit[],
  target: { orderIndex: number; logicalUnitKey: string },
): CycleRemapUnit {
  const sameKey = newRevisionUnits.find((unit) => unit.logicalUnitKey === target.logicalUnitKey);
  if (sameKey) return sameKey;

  const followingKeys = oldRevisionUnits
    .filter((unit) => unit.orderIndex > target.orderIndex)
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((unit) => unit.logicalUnitKey);
  for (const key of followingKeys) {
    const match = newRevisionUnits.find((unit) => unit.logicalUnitKey === key);
    if (match) return match;
  }

  const first = [...newRevisionUnits].sort((a, b) => a.orderIndex - b.orderIndex)[0];
  if (!first) throw new Error('Cannot remap a cycle unit onto a revision with no units.');
  return first;
}
