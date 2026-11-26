import { useCallback, useEffect, useRef, useState } from 'react';
import { prepareTrainingV2PlanCreate } from '../services/trainingV2DraftStorage';

import {
  createTrainingV2Plan,
  getTrainingV2Plan,
  resolveTrainingV2ExerciseDetails,
  TrainingV2ConflictError,
  updateTrainingV2Plan,
} from '../services/trainingV2Api';
import {
  buildCreatePlanInput,
  buildUpdatePlanInput,
  createEmptyEditorState,
  getEditorValidationIssues,
  isEditorStateDirty,
  mapTrainingPlanToEditorState,
  trainingV2EditorReducer,
} from '../models/trainingV2EditorModel';

export function useTrainingV2PlanEditor(planId) {
  const mode = planId ? 'edit' : 'create';
  const [state, setState] = useState(createEmptyEditorState);
  const [initialState, setInitialState] = useState(() => (mode === 'create' ? state : null));
  const [expectedVersion, setExpectedVersion] = useState(null);
  const [loading, setLoading] = useState(mode === 'edit');
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [conflict, setConflict] = useState(false);
  const savingRef = useRef(false);
  const savedResultRef = useRef(null);
  const pendingCreateRef = useRef(false);

  const dispatch = useCallback((action) => {
    if (savingRef.current || savedResultRef.current) return;
    if (action.type === 'HYDRATE') pendingCreateRef.current = Boolean(action.state?.pendingCreate);
    else if (pendingCreateRef.current) return;
    setState((previous) => trainingV2EditorReducer(previous, action));
  }, []);

  const load = useCallback(async () => {
    if (mode !== 'edit') return;
    setLoading(true);
    setLoadError(null);
    try {
      const plan = await getTrainingV2Plan(planId);
      if (plan.sourceTemplateId) throw new Error('Grow-Pläne können nicht bearbeitet werden. Öffne den Plan unter „Trainingspläne“.');
      const details = await resolveTrainingV2ExerciseDetails(plan);
      const hydrated = mapTrainingPlanToEditorState(plan, details);
      setState(hydrated);
      setInitialState(hydrated);
      setExpectedVersion(plan.version);
      setConflict(false);
    } catch (error) {
      setLoadError(error);
    } finally {
      setLoading(false);
    }
  }, [mode, planId]);

  useEffect(() => {
    if (mode === 'edit') void load();
    // Create mode already starts from a fresh empty state via useState's lazy
    // initializer; it must not reload/reset on every refocus of the screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dirty = initialState !== null && isEditorStateDirty(initialState, state);

  const save = useCallback(async () => {
    if (savingRef.current) return { ok: false };
    // The server has succeeded but local draft cleanup/navigation may need a retry.
    // Return that success again instead of creating another plan.
    if (savedResultRef.current) return savedResultRef.current;
    const validationIssues = getEditorValidationIssues(state, { mode });
    if (validationIssues.length > 0) {
      setSaveError({ type: 'validation', issues: validationIssues });
      return { ok: false, issues: validationIssues };
    }

    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      let savedState = state;
      let plan;
      if (mode === 'create') {
        const prepared = await prepareTrainingV2PlanCreate(state, buildCreatePlanInput(state));
        savedState = prepared.editorState;
        pendingCreateRef.current = true;
        setState(savedState);
        plan = await createTrainingV2Plan(savedState.pendingCreate.input, { ownerId: prepared.ownerId });
      } else {
        plan = await updateTrainingV2Plan(planId, buildUpdatePlanInput(state, expectedVersion));
      }
      // The just-saved local state is now the persisted baseline, so `dirty` must
      // deterministically flip to false right away, independent of render/effect timing.
      setInitialState(savedState);
      savedResultRef.current = { ok: true, plan };
      return savedResultRef.current;
    } catch (error) {
      if (mode === 'edit' && error instanceof TrainingV2ConflictError) setConflict(true);
      setSaveError({ type: 'api', error });
      return { ok: false, error };
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [state, mode, planId, expectedVersion]);

  const reloadAfterConflict = useCallback(async () => {
    setConflict(false);
    setSaveError(null);
    await load();
  }, [load]);

  return {
    mode,
    state,
    initialState,
    expectedVersion,
    dispatch,
    loading,
    loadError,
    retryLoad: load,
    dirty,
    saving,
    createPending: mode === 'create' && Boolean(state.pendingCreate),
    saveError,
    conflict,
    save,
    reloadAfterConflict,
  };
}
