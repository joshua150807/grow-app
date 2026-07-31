import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { listTrainingV2Templates } from '../services/trainingV2Api';

// Mirrors useTrainingV2Plans' request-sequence guarding (stale responses from an in-flight
// request must never overwrite a newer one), but without its owner-scoped module cache — the
// Grow template catalog is the same for every signed-in user, so there is no cross-user leak
// risk to guard against, and refetching on every focus (e.g. returning from a template's
// detail screen after Save/Unsave/Activate) is exactly what keeps this list consistent.
export function useTrainingV2Templates() {
  const [templates, setTemplates] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [fetching, setFetching] = useState(false);
  const requestSequenceRef = useRef(0);
  const hasLoadedRef = useRef(false);

  const load = useCallback(async ({ refresh = false } = {}) => {
    const requestSequence = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestSequence;
    if (refresh) setRefreshing(true);
    else if (!hasLoadedRef.current) setInitialLoading(true);
    else setFetching(true);
    setError(null);

    try {
      const nextTemplates = await listTrainingV2Templates();
      if (requestSequence !== requestSequenceRef.current) return;
      hasLoadedRef.current = true;
      setTemplates(nextTemplates);
    } catch (nextError) {
      if (requestSequence !== requestSequenceRef.current) return;
      setError(nextError);
    } finally {
      if (requestSequence !== requestSequenceRef.current) return;
      setInitialLoading(false);
      setFetching(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void load();
    return () => {
      requestSequenceRef.current += 1;
    };
  }, [load]));

  return {
    templates,
    loading: initialLoading,
    initialLoading,
    fetching,
    refreshing,
    error,
    retry: load,
    refresh: useCallback(() => load({ refresh: true }), [load]),
  };
}
