import { useCallback, useEffect, useRef, useState } from 'react';

import {
  completeSessionSet, createTrainingV2SessionDraft, getSessionSetInputIssue, getTrainingV2SessionSaveIssue,
  isDefinitiveTrainingV2SessionRejection, recordRestSecondsForSet, sessionSetInputIssueMessage, setRestTimer,
  stampSessionEndedAt, uncompleteSessionSet, unlockRejectedTrainingV2SessionDraft, updateExerciseNote, updateSessionSetInput,
} from '../models/trainingV2SessionModel';
import { getTrainingV2Plan, resolveTrainingV2ExerciseNames } from '../services/trainingV2Api';
import {
  clearTrainingV2SessionDraft, loadTrainingV2SessionDraft, saveTrainingV2SessionDraft, requireTrainingV2SessionOwner,
} from '../services/trainingV2SessionDraftStorage';
import { saveTrainingV2Session } from '../services/trainingV2SessionSave';

export function useTrainingV2Session(planId, unitId) {
  const [ownerId, setOwnerId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const requestSequenceRef = useRef(0);
  const draftRef = useRef(null);
  const busyRef = useRef(false);
  const ownerRef = useRef(null);
  const applyDraft = useCallback((next) => { draftRef.current = next; setDraft(next); }, []);

  const load = useCallback(async () => {
    const sequence = ++requestSequenceRef.current;
    setLoading(true);
    setError(null);
    applyDraft(null);
    try {
      const owner = await requireTrainingV2SessionOwner();
      if (sequence !== requestSequenceRef.current) return;
      ownerRef.current = owner;
      setOwnerId(owner);
      const existing = await loadTrainingV2SessionDraft(owner, planId, unitId);
      if (sequence !== requestSequenceRef.current) return;
      if (existing) { applyDraft(existing); return; }
      const plan = await getTrainingV2Plan(planId);
      const unit = plan.revision.units.find((candidate) => candidate.id === unitId);
      if (!unit) throw new Error('Diese Einheit ist im Trainingsplan nicht mehr vorhanden.');
      if (unit.unitType !== 'strength') throw new Error('Nur Krafteinheiten können protokolliert werden.');
      const names = await resolveTrainingV2ExerciseNames(plan);
      if (sequence !== requestSequenceRef.current) return;
      const created = createTrainingV2SessionDraft(plan, unit, names);
      await saveTrainingV2SessionDraft(owner, planId, unitId, created);
      if (sequence === requestSequenceRef.current) applyDraft(created);
    } catch (nextError) {
      if (sequence === requestSequenceRef.current) setError(nextError);
    } finally {
      if (sequence === requestSequenceRef.current) setLoading(false);
    }
  }, [planId, unitId, applyDraft]);

  useEffect(() => {
    void load();
    return () => { requestSequenceRef.current += 1; };
  }, [load]);

  const mutate = useCallback((update) => {
    const current = draftRef.current;
    // After the first send, edits and background timer events cannot change the replay.
    if (!current || busyRef.current || current.pendingSave) return;
    const next = update(current);
    applyDraft(next);
    if (ownerRef.current) {
      void saveTrainingV2SessionDraft(ownerRef.current, planId, unitId, next).catch(setSaveError);
    }
  }, [planId, unitId, applyDraft]);
  const updateInput = useCallback((exerciseIndex, setIndex, patch) => {
    mutate((current) => updateSessionSetInput(current, exerciseIndex, setIndex, patch));
  }, [mutate]);
  const updateNote = useCallback((exerciseIndex, note) => {
    mutate((current) => updateExerciseNote(current, exerciseIndex, note));
  }, [mutate]);
  const completeSet = useCallback((exerciseIndex, setIndex, { now = () => new Date() } = {}) => {
    let plannedRest = null;
    mutate((current) => {
      const set = current.exercises[exerciseIndex].sets[setIndex];
      const issue = getSessionSetInputIssue(set);
      if (issue) {
        setSaveError(new Error(`${sessionSetInputIssueMessage(issue)} Danach kannst du den Satz bestätigen.`));
        return current;
      }
      const { state, plannedRestSeconds } = completeSessionSet(current, exerciseIndex, setIndex, { completedAt: now().toISOString() });
      plannedRest = plannedRestSeconds;
      return setRestTimer(state, { endsAt: now().getTime() + plannedRestSeconds * 1000, plannedSeconds: plannedRestSeconds, exerciseIndex, setIndex });
    });
    return plannedRest;
  }, [mutate]);
  const uncompleteSet = useCallback((exerciseIndex, setIndex) => {
    mutate((current) => uncompleteSessionSet(current, exerciseIndex, setIndex));
  }, [mutate]);
  const setTimerEndsAt = useCallback((endsAt) => {
    mutate((current) => current.restTimer ? setRestTimer(current, { ...current.restTimer, endsAt }) : current);
  }, [mutate]);
  const dismissTimer = useCallback((seconds) => {
    mutate((current) => {
      if (!current.restTimer) return current;
      const { exerciseIndex, setIndex } = current.restTimer;
      return setRestTimer(recordRestSecondsForSet(current, exerciseIndex, setIndex, seconds), null);
    });
  }, [mutate]);

  const discard = useCallback(async () => {
    if (busyRef.current) return { ok: false };
    busyRef.current = true;
    setSaving(true);
    const sequence = requestSequenceRef.current;
    try {
      if (ownerRef.current) await clearTrainingV2SessionDraft(ownerRef.current, planId, unitId);
      if (sequence !== requestSequenceRef.current) return { ok: false };
      applyDraft(null);
      return { ok: true };
    } catch (nextError) {
      if (sequence === requestSequenceRef.current) setSaveError(nextError);
      return { ok: false, error: nextError };
    } finally {
      busyRef.current = false;
      if (sequence === requestSequenceRef.current) setSaving(false);
    }
  }, [planId, unitId, applyDraft]);

  const save = useCallback(async (status, { now = () => new Date() } = {}) => {
    const current = draftRef.current;
    if (!current || busyRef.current) return { ok: false };
    const issue = current.pendingSave ? null : getTrainingV2SessionSaveIssue(current, status);
    if (issue) {
      const nextError = new Error(issue);
      setSaveError(nextError);
      return { ok: false, error: nextError };
    }
    busyRef.current = true;
    setSaving(true);
    setSaveError(null);
    const sequence = requestSequenceRef.current;
    let sent = false;
    try {
      // Save the entire terminal snapshot and status before sending. A process restart
      // or an unknown network result must replay the same key, timestamps and values.
      let snapshot = current;
      if (!current.pendingSave) {
        snapshot = stampSessionEndedAt(current, now().toISOString());
        if (snapshot.restTimer) {
          const { exerciseIndex, setIndex } = snapshot.restTimer;
          const completedAt = snapshot.exercises[exerciseIndex].sets[setIndex].completedAt;
          const seconds = Math.max(0, Math.round((Date.parse(snapshot.endedAt) - Date.parse(completedAt)) / 1000));
          snapshot = setRestTimer(recordRestSecondsForSet(snapshot, exerciseIndex, setIndex, seconds), null);
        }
        snapshot = { ...snapshot, pendingSave: { status } };
      }
      await saveTrainingV2SessionDraft(ownerRef.current, planId, unitId, snapshot);
      if (sequence !== requestSequenceRef.current) return { ok: false };
      applyDraft(snapshot);
      sent = true;
      const outcome = await saveTrainingV2Session(snapshot, snapshot.pendingSave.status);
      if (sequence !== requestSequenceRef.current) return { ok: false };
      if (!outcome.ok) {
        // Only a deterministic pre-write rejection unlocks the draft for correction (Fixplan B3):
        // same idempotency key, same values, same endedAt -- nothing is lost or regenerated. Every
        // other failure (network, 5xx, unknown) keeps the locked pendingSave replay untouched.
        if (isDefinitiveTrainingV2SessionRejection(outcome.error)) {
          const unlocked = unlockRejectedTrainingV2SessionDraft(snapshot);
          await saveTrainingV2SessionDraft(ownerRef.current, planId, unitId, unlocked);
          if (sequence !== requestSequenceRef.current) return { ok: false };
          applyDraft(unlocked);
          const issue = getTrainingV2SessionSaveIssue(unlocked, snapshot.pendingSave.status);
          const unlockedError = new Error(issue
            ?? 'Der Server hat einzelne Werte abgelehnt. Bitte prüfe deine Eingaben; dein Training bleibt als Entwurf erhalten.');
          setSaveError(unlockedError);
          return { ok: false, error: unlockedError, unlocked: true };
        }
        setSaveError(outcome.error);
        return outcome;
      }
      await clearTrainingV2SessionDraft(ownerRef.current, planId, unitId);
      if (sequence !== requestSequenceRef.current) return { ok: false };
      applyDraft(null);
      return outcome;
    } catch (nextError) {
      if (sequence === requestSequenceRef.current) {
        if (!sent && !current.pendingSave) applyDraft(current);
        setSaveError(nextError);
      }
      return { ok: false, error: nextError };
    } finally {
      busyRef.current = false;
      if (sequence === requestSequenceRef.current) setSaving(false);
    }
  }, [planId, unitId, applyDraft]);
  const clearSaveError = useCallback(() => setSaveError(null), []);
  return {
    ownerId, draft, loading, error, retryLoad: load, updateInput, updateNote,
    completeSet, uncompleteSet, setTimerEndsAt, dismissTimer, discard, save,
    saving, saveError, clearSaveError, locked: saving || Boolean(draft?.pendingSave),
  };
}
