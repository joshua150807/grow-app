import { useCallback, useRef, useState } from 'react';

import {
  activateTrainingV2Template,
  saveTrainingV2Template,
  unsaveTrainingV2Template,
} from '../services/trainingV2Api';

// Mirrors useTrainingV2PlanActions' runAction wrapper (pending/error state, no optimistic
// updates), but for the three template-keyed mutations. None of these three ever return the
// template's own content (see templateUserPlanResponseSchema) — only the refreshed userPlan
// projection — so `onSuccess` here is always a refetch (useTrainingV2TemplateDetail.retry),
// not a local tree merge.
export function useTrainingV2TemplateActions(templateId, onSuccess) {
  const [pending, setPending] = useState(null);
  const [error, setError] = useState(null);
  const pendingRef = useRef(false);

  const runAction = useCallback(async (kind, task) => {
    if (pendingRef.current) return { ok: false };
    pendingRef.current = true;
    setPending(kind);
    setError(null);

    try {
      const userPlan = await task();
      await onSuccess(userPlan);
      return { ok: true, userPlan };
    } catch (caughtError) {
      setError(caughtError);
      return { ok: false, error: caughtError };
    } finally {
      pendingRef.current = false;
      setPending(null);
    }
  }, [onSuccess]);

  const save = useCallback(() => (
    runAction('save', () => saveTrainingV2Template(templateId))
  ), [templateId, runAction]);

  const unsave = useCallback(() => (
    runAction('unsave', () => unsaveTrainingV2Template(templateId))
  ), [templateId, runAction]);

  const activate = useCallback(() => (
    runAction('activate', () => activateTrainingV2Template(templateId))
  ), [templateId, runAction]);

  const clearError = useCallback(() => setError(null), []);

  return {
    pending, error, save, unsave, activate, clearError,
  };
}
