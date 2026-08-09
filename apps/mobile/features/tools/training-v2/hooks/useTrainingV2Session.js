import { useCallback, useEffect, useRef, useState } from 'react';

import { requireCurrentUserId } from '../../../../services/authUser';
import {
  completeSessionSet,
  createTrainingV2SessionDraft,
  recordRestSecondsForSet,
  setRestTimer,
  stampSessionEndedAt,
  uncompleteSessionSet,
  updateExerciseNote,
  updateSessionSetInput,
} from '../models/trainingV2SessionModel';
import { getTrainingV2Plan, resolveTrainingV2ExerciseNames } from '../services/trainingV2Api';
import {
  clearTrainingV2SessionDraft,
  loadTrainingV2SessionDraft,
  saveTrainingV2SessionDraft,
} from '../services/trainingV2SessionDraftStorage';
import { saveTrainingV2Session } from '../services/trainingV2SessionSave';

// Loads (or, on first entry, creates and immediately persists) the AsyncStorage-backed draft
// for one specific plan+unit, then keeps every local mutation written straight back to
// storage — so an app kill mid-session always restores from the last completed action, never
// from a periodic/debounced snapshot that could be behind by more than one set.
export function useTrainingV2Session(planId, unitId) {
  const [ownerId, setOwnerId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const requestSequenceRef = useRef(0);

  const load = useCallback(async () => {
    const requestSequence = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestSequence;
    setLoading(true);
    setError(null);

    try {
      const owner = await requireCurrentUserId();
      if (requestSequence !== requestSequenceRef.current) return;
      setOwnerId(owner);

      const existing = await loadTrainingV2SessionDraft(owner, planId, unitId);
      if (requestSequence !== requestSequenceRef.current) return;
      if (existing) {
        setDraft(existing);
        return;
      }

      const plan = await getTrainingV2Plan(planId);
      const unit = plan.revision.units.find((candidate) => candidate.id === unitId);
      if (!unit) throw new Error('Diese Einheit ist im Trainingsplan nicht mehr vorhanden.');
      if (unit.unitType !== 'strength') throw new Error('Nur Krafteinheiten können protokolliert werden.');
      const names = await resolveTrainingV2ExerciseNames(plan);
      if (requestSequence !== requestSequenceRef.current) return;

      const created = createTrainingV2SessionDraft(plan, unit, names);
      await saveTrainingV2SessionDraft(owner, planId, unitId, created);
      if (requestSequence !== requestSequenceRef.current) return;
      setDraft(created);
    } catch (nextError) {
      if (requestSequence !== requestSequenceRef.current) return;
      setError(nextError);
    } finally {
      if (requestSequence === requestSequenceRef.current) setLoading(false);
    }
  }, [planId, unitId]);

  useEffect(() => {
    void load();
    return () => {
      requestSequenceRef.current += 1;
    };
  }, [load]);

  const persist = useCallback((nextDraft) => {
    setDraft(nextDraft);
    if (ownerId) void saveTrainingV2SessionDraft(ownerId, planId, unitId, nextDraft);
  }, [ownerId, planId, unitId]);

  const updateInput = useCallback((exerciseIndex, setIndex, patch) => {
    setDraft((current) => {
      if (!current) return current;
      const next = updateSessionSetInput(current, exerciseIndex, setIndex, patch);
      if (ownerId) void saveTrainingV2SessionDraft(ownerId, planId, unitId, next);
      return next;
    });
  }, [ownerId, planId, unitId]);

  const updateNote = useCallback((exerciseIndex, note) => {
    setDraft((current) => {
      if (!current) return current;
      const next = updateExerciseNote(current, exerciseIndex, note);
      if (ownerId) void saveTrainingV2SessionDraft(ownerId, planId, unitId, next);
      return next;
    });
  }, [ownerId, planId, unitId]);

  const completeSet = useCallback((exerciseIndex, setIndex, { now = () => new Date() } = {}) => {
    if (!draft) return null;
    const { state: completed, plannedRestSeconds } = completeSessionSet(
      draft, exerciseIndex, setIndex, { completedAt: now().toISOString() },
    );
    const withTimer = setRestTimer(completed, {
      endsAt: now().getTime() + plannedRestSeconds * 1000,
      plannedSeconds: plannedRestSeconds,
      exerciseIndex,
      setIndex,
    });
    persist(withTimer);
    return plannedRestSeconds;
  }, [draft, persist]);

  const uncompleteSet = useCallback((exerciseIndex, setIndex) => {
    if (!draft) return;
    persist(uncompleteSessionSet(draft, exerciseIndex, setIndex));
  }, [draft, persist]);

  const setTimerEndsAt = useCallback((endsAt) => {
    setDraft((current) => {
      if (!current?.restTimer) return current;
      const next = setRestTimer(current, { ...current.restTimer, endsAt });
      if (ownerId) void saveTrainingV2SessionDraft(ownerId, planId, unitId, next);
      return next;
    });
  }, [ownerId, planId, unitId]);

  // Ends the active rest timer, recording how long the rest actually took on the set that
  // started it — called both when the countdown reaches zero on its own and when the user
  // taps to skip it early.
  const dismissTimer = useCallback((actualRestSeconds) => {
    setDraft((current) => {
      if (!current?.restTimer) return current;
      const { exerciseIndex, setIndex } = current.restTimer;
      const recorded = recordRestSecondsForSet(current, exerciseIndex, setIndex, actualRestSeconds);
      const next = setRestTimer(recorded, null);
      if (ownerId) void saveTrainingV2SessionDraft(ownerId, planId, unitId, next);
      return next;
    });
  }, [ownerId, planId, unitId]);

  const discard = useCallback(async () => {
    if (ownerId) await clearTrainingV2SessionDraft(ownerId, planId, unitId);
    setDraft(null);
  }, [ownerId, planId, unitId]);

  const save = useCallback(async (status, { now = () => new Date() } = {}) => {
    if (!draft) return { ok: false };
    setSaving(true);
    setSaveError(null);

    // endedAt is stamped once, on the very first save attempt, and persisted to the draft
    // store immediately — stampSessionEndedAt is a no-op on a draft that already carries one,
    // so a retry (this same draft, after a failed attempt) always reuses that exact value,
    // exactly like idempotencyKey already does.
    const stamped = stampSessionEndedAt(draft, now().toISOString());
    if (stamped !== draft) {
      setDraft(stamped);
      if (ownerId) await saveTrainingV2SessionDraft(ownerId, planId, unitId, stamped);
    }

    const outcome = await saveTrainingV2Session(stamped, status);
    setSaving(false);
    if (outcome.ok) {
      if (ownerId) await clearTrainingV2SessionDraft(ownerId, planId, unitId);
      setDraft(null);
      return outcome;
    }
    setSaveError(outcome.error);
    return outcome;
  }, [draft, ownerId, planId, unitId]);

  const clearSaveError = useCallback(() => setSaveError(null), []);

  return {
    ownerId,
    draft,
    loading,
    error,
    retryLoad: load,
    updateInput,
    updateNote,
    completeSet,
    uncompleteSet,
    setTimerEndsAt,
    dismissTimer,
    discard,
    save,
    saving,
    saveError,
    clearSaveError,
  };
}
