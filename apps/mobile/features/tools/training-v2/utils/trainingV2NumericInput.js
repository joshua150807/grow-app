// Mirror of TRAINING_V2_LIMITS / hasAtMostDecimals in packages/shared/src/training/primitives.ts.
// Kept local because the Node test runtime resolves @grow/shared to its prebuilt dist; the
// drift guard in testing/trainingV2ReleaseFixes.test.cjs fails if these values ever diverge.
export const TRAINING_V2_LIMITS = Object.freeze({
  maxWeightKg: 1_500,
  weightDecimals: 3,
  maxReps: 1_000,
  minWeeklyGoal: 1,
  maxWeeklyGoal: 7,
  maxActualRestSeconds: 86_400,
  maxPlannedRestSeconds: 3_600,
  maxReliableSessionSeconds: 6 * 60 * 60,
  maxPlanUnits: 14,
  maxExercisesPerUnit: 30,
  maxSetsPerExercise: 30,
});

export function hasAtMostDecimals(value, decimals) {
  const scaled = value * 10 ** decimals;
  return Math.abs(scaled - Math.round(scaled)) < 1e-6;
}

// Plain-text field caps (Fixplan B3): "1500,125" (8 chars) and "1000" (4 chars) are the longest valid entries.
export const TRAINING_V2_WEIGHT_INPUT_MAX_LENGTH = 8;
export const TRAINING_V2_REPS_INPUT_MAX_LENGTH = 4;

export const TRAINING_V2_WEIGHT_INPUT_HINT = 'Erlaubt sind 0 bis 1.500 kg mit höchstens 3 Nachkommastellen, zum Beispiel 12,5.';
export const TRAINING_V2_REPS_INPUT_HINT = 'Erlaubt sind ganze Wiederholungen von 1 bis 1.000.';

export function isPlausibleTrainingV2WeightKg(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    && value <= TRAINING_V2_LIMITS.maxWeightKg && hasAtMostDecimals(value, TRAINING_V2_LIMITS.weightDecimals);
}

export function isPlausibleTrainingV2Reps(value) {
  return Number.isInteger(value) && value > 0 && value <= TRAINING_V2_LIMITS.maxReps;
}

// Keep text in the UI/draft, and derive numbers without rewriting intermediate input. Values outside
// the shared input limits (Fixplan B2/B3) are `valid: false` with `value: null`, so they can never
// reach a save payload, while the typed text itself stays in the draft for the user to correct.
export function parseTrainingV2WeightText(text) {
  const input = typeof text === 'string' ? text.trim() : '';
  if (!input) return { valid: true, value: null };
  if (!/^(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(input)) return { valid: false, value: null };
  const value = Number(input.replace(',', '.'));
  const valid = isPlausibleTrainingV2WeightKg(value);
  return { valid, value: valid ? value : null };
}

export function parseTrainingV2RepsText(text) {
  const input = typeof text === 'string' ? text.trim() : '';
  if (!input) return { valid: true, value: null };
  if (!/^\d+$/.test(input)) return { valid: false, value: null };
  const value = Number(input);
  const valid = isPlausibleTrainingV2Reps(value);
  return { valid, value: valid ? value : null };
}
