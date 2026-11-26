import { useCallback, useEffect, useRef, useState } from 'react';

import {
  clearTrainingV2Draft,
  loadTrainingV2Draft,
  saveTrainingV2Draft,
} from '../services/trainingV2DraftStorage';
import { createEmptyEditorState } from '../models/trainingV2EditorModel';
import { supabase } from '../../../../services/supabaseClient';

const AUTOSAVE_DEBOUNCE_MS = 800;

// `undefined` (not `null`) marks "auth state not yet resolved" — distinct from `null`,
// which means "confirmed signed out". Conflating the two would make the very first
// resolution of a real session (undefined -> a user id) look like a switch away from a
// previous owner and wipe editor content a sibling effect (useTrainingV2PlanEditor's own
// load()) may have already legitimately populated.
const AUTH_STATE_UNRESOLVED = undefined;

// Composes local-draft persistence (debounced autosave, restore-on-mount, discard, and an
// edit-mode version-conflict decision) on top of an already-running useTrainingV2PlanEditor
// instance. Kept as its own hook rather than folded into useTrainingV2PlanEditor so the
// editor hook itself stays untouched and this can be reasoned about (and tested) in
// isolation.
export function useTrainingV2PlanDraft({
  mode, planId, loading, state, dispatch, initialState, expectedVersion, dirty,
}) {
  const [userId, setUserId] = useState(AUTH_STATE_UNRESOLVED);
  const [draftRestored, setDraftRestored] = useState(false);
  const [draftConflict, setDraftConflict] = useState(null);
  const checkedKeyRef = useRef(null);
  // Gates autosave: only equals the current (userId:mode:planId) key once the restore-check
  // below has fully settled *for that exact key* (found nothing, restored a draft, or
  // surfaced a conflict) — so a fast typist can never trigger a write that overwrites a
  // not-yet-loaded persisted draft with blank/partial state. This must be a ref, not state:
  // on the very render where userId changes, the reset-flags effect and the autosave effect
  // both run in the same commit, but a state value read by "const [x] = useState(...)" is
  // snapshotted once per render — the autosave effect's closure would still see the *old*
  // owner's already-true value even though a sibling effect "reset" it moments earlier in
  // that same render, because the reset only becomes visible on the *next* render. A ref
  // mutation is visible immediately, so resetting it in one effect is seen by a later effect
  // in the very same render — closing the window where a switch could schedule a write of
  // the previous owner's still-stale state under the new owner's key.
  const hydrationSettledKeyRef = useRef(null);
  // A ref mutation alone never schedules a re-render, so on the common "no existing draft"
  // path (which never touches draftRestored/draftConflict) nothing would ever prompt the
  // autosave effect to re-run and notice the ref changed once the async restore-check
  // resolves later. This tick is a pure re-render trigger included in the autosave effect's
  // dependency array for exactly that purpose — the actual gating decision still always
  // reads hydrationSettledKeyRef.current fresh, never this counter's value.
  const [hydrationSettledTick, setHydrationSettledTick] = useState(0);
  const previousOwnerRef = useRef(AUTH_STATE_UNRESOLVED);
  const autosaveTimeoutRef = useRef(null);
  const writePromiseRef = useRef(Promise.resolve());
  const clearingRef = useRef(false);
  const [persistenceError, setPersistenceError] = useState(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setUserId(data?.session?.user?.id ?? null);
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => {
      active = false;
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  // Only a genuine owner change (not the initial "unresolved -> first known user" mount
  // step) must instantly discard whatever plan content is currently on screen — otherwise
  // the new owner could see the previous owner's name/units/exercises for a frame before
  // anything else in this hook has a chance to react.
  useEffect(() => {
    const previousOwner = previousOwnerRef.current;
    previousOwnerRef.current = userId;
    if (previousOwner === AUTH_STATE_UNRESOLVED) return;
    if (previousOwner === userId) return;
    dispatch({ type: 'HYDRATE', state: createEmptyEditorState() });
  }, [userId, dispatch]);

  // A user switch (or logout) invalidates any restore decision made under a previous owner
  // and must never leave that owner's draft state lingering in memory for the next one.
  // Also re-arms the restore check for a plain plan-to-plan navigation under the same
  // owner (mode/planId change), not only for an owner change.
  useEffect(() => {
    setDraftRestored(false);
    setDraftConflict(null);
    hydrationSettledKeyRef.current = null;
    checkedKeyRef.current = null;
  }, [userId, mode, planId]);

  useEffect(() => {
    if (!userId || loading) return undefined;
    const key = `${userId}:${mode}:${planId ?? ''}`;
    if (checkedKeyRef.current === key) return undefined;
    checkedKeyRef.current = key;

    let cancelled = false;
    (async () => {
      try {
        const draft = await loadTrainingV2Draft(userId, mode, planId);
        if (!draft || cancelled) return;

        if (mode === 'edit' && draft.basePlanVersion !== expectedVersion) {
          setDraftConflict({ editorState: draft.editorState, basePlanVersion: draft.basePlanVersion });
          return;
        }

        dispatch({ type: 'HYDRATE', state: draft.editorState });
        setDraftRestored(true);
      } catch (error) {
        if (!cancelled) setPersistenceError(error);
      } finally {
        if (!cancelled) {
          hydrationSettledKeyRef.current = key;
          setHydrationSettledTick((tick) => tick + 1);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [userId, mode, planId, loading, expectedVersion, dispatch]);

  useEffect(() => {
    const key = `${userId}:${mode}:${planId ?? ''}`;
    if (!userId || loading || !dirty || clearingRef.current || draftConflict || hydrationSettledKeyRef.current !== key) return undefined;
    autosaveTimeoutRef.current = setTimeout(() => {
      writePromiseRef.current = writePromiseRef.current.catch(() => {}).then(() => (
        saveTrainingV2Draft(userId, mode, planId, { basePlanVersion: expectedVersion, editorState: state })
      ));
      void writePromiseRef.current.then(() => setPersistenceError(null), setPersistenceError);
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(autosaveTimeoutRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrationSettledTick is a pure
    // re-render trigger; the actual guard always reads hydrationSettledKeyRef.current fresh.
  }, [userId, mode, planId, loading, dirty, draftConflict, expectedVersion, state, hydrationSettledTick]);

  const clearDraft = useCallback(async () => {
    clearingRef.current = true;
    // Cancels a still-pending autosave synchronously rather than relying on React to
    // notice `dirty` turned false and tear the effect down in time — a raw setTimeout
    // keeps counting down against wall-clock time regardless of pending re-renders, so a
    // save that resolves close to the debounce window could otherwise let a stale
    // autosave fire right after this call and recreate the draft it just deleted.
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
      autosaveTimeoutRef.current = null;
    }
    try {
      await writePromiseRef.current.catch(() => {});
      if (userId) await clearTrainingV2Draft(userId, mode, planId);
      setDraftRestored(false);
      setPersistenceError(null);
    } catch (error) {
      setPersistenceError(error);
      throw error;
    } finally {
      clearingRef.current = false;
    }
  }, [userId, mode, planId]);

  const dismissDraftNotice = useCallback(() => {
    dispatch({ type: 'HYDRATE', state: initialState });
    void clearDraft().catch(() => {});
  }, [dispatch, initialState, clearDraft]);

  const keepDraft = useCallback(() => {
    if (!draftConflict) return;
    dispatch({ type: 'HYDRATE', state: draftConflict.editorState });
    setDraftConflict(null);
    setDraftRestored(true);
  }, [draftConflict, dispatch]);

  const loadCurrentPlanInstead = useCallback(() => {
    setDraftConflict(null);
    void clearDraft().catch(() => {});
  }, [clearDraft]);

  return {
    persistenceError,
    draftRestored,
    draftConflict,
    keepDraft,
    loadCurrentPlanInstead,
    dismissDraftNotice,
    clearDraft,
  };
}
