import { createHash } from 'node:crypto';
import type { CreateTrainingSessionInput } from '@grow/shared/src/training/sessions.js';

// A stored, comparable digest of the full save-session request, keyed manually (not by
// spreading the parsed object) so JSON.stringify's key order never depends on how the client
// happened to format its request body. Exercises/sets are sorted by their own orderIndex
// (already validated unique by createTrainingSessionInputSchema) so two semantically
// identical requests fingerprint identically even if their arrays were submitted in a
// different order. idempotencyKey itself is excluded -- it is the lookup key this fingerprint
// is compared under, not part of the payload being compared.
export function computeSessionRequestFingerprint(input: CreateTrainingSessionInput): string {
  const canonical = {
    planId: input.planId,
    unitId: input.unitId,
    status: input.status,
    exercises: [...input.exercises]
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((exercise) => ({
        exerciseId: exercise.exerciseId,
        logicalTargetExerciseKey: exercise.logicalTargetExerciseKey,
        orderIndex: exercise.orderIndex,
        note: exercise.note,
        sets: [...exercise.sets]
          .sort((a, b) => a.orderIndex - b.orderIndex)
          .map((set) => ({
            clientSetId: set.clientSetId,
            logicalTargetSetKey: set.logicalTargetSetKey,
            orderIndex: set.orderIndex,
            setType: set.setType,
            weightKg: set.weightKg,
            reps: set.reps,
            rir: set.rir,
            note: set.note,
            completedAt: set.completedAt,
            actualRestSeconds: set.actualRestSeconds,
          })),
      })),
  };
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}
