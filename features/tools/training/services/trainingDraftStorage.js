import AsyncStorage from '@react-native-async-storage/async-storage';

const CUSTOM_PLAN_DRAFT_KEY = '@grow/training/custom-plan-draft-v1';

function safeText(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function makeTempId(prefix = 'draft') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeDayType(value) {
  if (value === 'run') return 'run';
  if (value === 'rest') return 'rest';
  return 'gym';
}

function normalizeExercise(exercise = {}) {
  return {
    id: safeText(exercise.id) || makeTempId('ex'),
    name: safeText(exercise.name),
    weight: safeText(exercise.weight),
    sets: safeText(exercise.sets),
    reps: safeText(exercise.reps),
    note: safeText(exercise.note),
  };
}

function normalizeDay(day = {}) {
  const type = normalizeDayType(day.type);
  const exercises = Array.isArray(day.exercises) ? day.exercises : [];

  return {
    id: safeText(day.id) || makeTempId('day'),
    type,
    name: safeText(day.name),
    exercises: type === 'gym' ? exercises.map(normalizeExercise) : [],
  };
}


function hasMeaningfulDraftInput(draft = {}) {
  if (safeText(draft.planName).trim()) return true;

  const days = Array.isArray(draft.days) ? draft.days : [];

  return days.some((day) => {
    if (safeText(day.name).trim()) return true;
    if (normalizeDayType(day.type) !== 'gym') return true;

    const exercises = Array.isArray(day.exercises) ? day.exercises : [];

    return exercises.some((exercise) =>
      safeText(exercise.name).trim() ||
      safeText(exercise.weight).trim() ||
      safeText(exercise.sets).trim() ||
      safeText(exercise.reps).trim() ||
      safeText(exercise.note).trim()
    );
  });
}

function normalizeDraft(draft = {}) {
  const days = Array.isArray(draft.days) ? draft.days.map(normalizeDay) : [];

  return {
    planName: safeText(draft.planName),
    days: days.length ? days : null,
    updatedAt: typeof draft.updatedAt === 'number' ? draft.updatedAt : Date.now(),
  };
}

export async function loadCustomTrainingPlanDraft() {
  try {
    const raw = await AsyncStorage.getItem(CUSTOM_PLAN_DRAFT_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const draft = normalizeDraft(parsed);

    if (!hasMeaningfulDraftInput(draft)) {
      return null;
    }

    return draft;
  } catch (error) {
    console.warn('[Training Draft] Failed to load draft:', error);
    return null;
  }
}

export async function saveCustomTrainingPlanDraft(draft) {
  try {
    const normalizedDraft = normalizeDraft({ ...draft, updatedAt: Date.now() });

    if (!hasMeaningfulDraftInput(normalizedDraft)) {
      await AsyncStorage.removeItem(CUSTOM_PLAN_DRAFT_KEY);
      return;
    }

    await AsyncStorage.setItem(
      CUSTOM_PLAN_DRAFT_KEY,
      JSON.stringify(normalizedDraft)
    );
  } catch (error) {
    console.warn('[Training Draft] Failed to save draft:', error);
  }
}

export async function clearCustomTrainingPlanDraft() {
  try {
    await AsyncStorage.removeItem(CUSTOM_PLAN_DRAFT_KEY);
  } catch (error) {
    console.warn('[Training Draft] Failed to clear draft:', error);
  }
}
