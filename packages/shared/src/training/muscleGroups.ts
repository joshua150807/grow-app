import { uiMuscleGroupSchema, type UiMuscleGroup } from './enums.js';

// System exercises use a finer, 20-value muscle catalog (systemExerciseMuscleSchema) that
// this maps down to the nine UI groups in uiMuscleGroupSchema. This is the single source of
// truth for that mapping: both the mobile picker and the API's private-exercise-draft
// resolution (deciding whether a draft exactly matches an existing system exercise) must
// agree on it, so it lives here rather than as two separately maintained copies.
//
// Most entries are an unambiguous semantic match (chest/biceps/triceps/forearms/abs share
// their name with a UI group; the remaining fine values are single-region muscles with one
// obvious UI group). "traps" and "lower_back" are resolved using the same name-keyword
// precedent the app's own legacy exercise-name-to-muscle-group inference already uses
// elsewhere (shrug/trapez/nacken -> shoulders; rueckenstrecker/back extension -> back).
// "hip_flexors" has no such precedent anywhere in the app, so — per "don't guess, fall back
// to Sonstiges" — it maps to 'other'.
const FINE_SYSTEM_MUSCLE_TO_UI_GROUP: Record<string, UiMuscleGroup> = {
  chest: 'chest',
  lats: 'back',
  upper_back: 'back',
  lower_back: 'back',
  quadriceps: 'legs',
  hamstrings: 'legs',
  glutes: 'legs',
  calves: 'legs',
  adductors: 'legs',
  abductors: 'legs',
  front_delts: 'shoulders',
  side_delts: 'shoulders',
  rear_delts: 'shoulders',
  traps: 'shoulders',
  biceps: 'biceps',
  triceps: 'triceps',
  abs: 'abs',
  obliques: 'abs',
  forearms: 'forearms',
  hip_flexors: 'other',
};

const UI_MUSCLE_GROUP_VALUES = new Set<string>(uiMuscleGroupSchema.options);

// Accepts either an already-resolved UI group (private exercises store one of the nine
// values directly) or a system exercise's fine muscle value (or null/undefined), and always
// returns one of the nine UI groups — never guessing when a fine value has no established
// mapping.
export function resolveUiMuscleGroup(mainMuscle: string | null | undefined): UiMuscleGroup {
  if (!mainMuscle) return 'other';
  if (UI_MUSCLE_GROUP_VALUES.has(mainMuscle)) return mainMuscle as UiMuscleGroup;
  return FINE_SYSTEM_MUSCLE_TO_UI_GROUP[mainMuscle] ?? 'other';
}
