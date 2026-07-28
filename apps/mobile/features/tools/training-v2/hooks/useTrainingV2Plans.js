import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { listTrainingV2Plans } from '../services/trainingV2Api';
import {
  getCachedTrainingV2Plans,
  getTrainingV2PlansOwnerId,
  setCachedTrainingV2Plans,
} from '../services/trainingV2PlansCache';

export function useTrainingV2Plans() {
  const initialOwnerId = getTrainingV2PlansOwnerId();
  const initialCachedPlans = getCachedTrainingV2Plans(initialOwnerId);

  // Seeding straight from the user-scoped cache (see trainingV2PlansCache.js) means a fresh
  // hook instance — e.g. a screen torn down and recreated across an interactive iOS
  // swipe-back — never has to fall back to an empty list and re-show a fullscreen "first
  // load" state just because its own local state started over, while never risking a
  // previous user's plans appearing as this one's initial state.
  const [plans, setPlans] = useState(initialCachedPlans ?? []);
  const [initialLoading, setInitialLoading] = useState(initialCachedPlans === null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [fetching, setFetching] = useState(false);
  const requestSequenceRef = useRef(0);

  const load = useCallback(async ({ refresh = false } = {}) => {
    const requestSequence = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestSequence;
    const ownerAtStart = getTrainingV2PlansOwnerId();
    if (refresh) setRefreshing(true);
    else if (getCachedTrainingV2Plans(ownerAtStart) === null) setInitialLoading(true);
    else setFetching(true);
    setError(null);

    try {
      const nextPlans = await listTrainingV2Plans();
      if (requestSequence !== requestSequenceRef.current) return;
      // The signed-in user must not have changed while this request was in flight (e.g. a
      // logout or a switch to a different user) — otherwise this response belongs to
      // whoever asked for it, not to whoever is signed in now, and must never be cached or
      // applied as theirs.
      if (getTrainingV2PlansOwnerId() !== ownerAtStart) return;
      setCachedTrainingV2Plans(ownerAtStart, nextPlans);
      setPlans(nextPlans);
    } catch (nextError) {
      if (requestSequence !== requestSequenceRef.current) return;
      if (getTrainingV2PlansOwnerId() !== ownerAtStart) return;
      setError(nextError);
    } finally {
      if (requestSequence !== requestSequenceRef.current) return;
      if (getTrainingV2PlansOwnerId() !== ownerAtStart) return;
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
    plans,
    // Kept for TrainingV2PlansScreen, which still gates on a single `loading` flag; aliasing
    // it to `initialLoading` only fixes its every-refocus flicker without changing its
    // contract (still true exactly for "nothing to show yet", never true again afterwards).
    loading: initialLoading,
    initialLoading,
    fetching,
    refreshing,
    error,
    retry: load,
    refresh: useCallback(() => load({ refresh: true }), [load]),
  };
}

