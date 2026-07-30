// Shared name handling for the "is this exercise already known" decision (picker create
// action) and for the value actually sent when creating a private exercise: trims the ends
// and collapses internal whitespace runs, without touching the exercise's own casing.
export function cleanExerciseName(name) {
  return (name ?? '').trim().replace(/\s+/g, ' ');
}

// Adds case-folding on top of cleanExerciseName so two names differing only by
// leading/trailing spaces, repeated internal spaces or letter case compare as identical —
// matching the database's own normalization for the private-exercise uniqueness index
// (20260729060000_training_v2_private_exercise_name_uniqueness.sql).
export function normalizeExerciseName(name) {
  return cleanExerciseName(name).toLowerCase();
}
