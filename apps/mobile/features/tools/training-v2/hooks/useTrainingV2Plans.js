import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { listTrainingV2Plans } from '../services/trainingV2Api';

export function useTrainingV2Plans() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const requestSequenceRef = useRef(0);

  const load = useCallback(async ({ refresh = false } = {}) => {
    const requestSequence = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestSequence;
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const nextPlans = await listTrainingV2Plans();
      if (requestSequence !== requestSequenceRef.current) return;
      setPlans(nextPlans);
    } catch (nextError) {
      if (requestSequence !== requestSequenceRef.current) return;
      setError(nextError);
    } finally {
      if (requestSequence !== requestSequenceRef.current) return;
      setLoading(false);
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
    loading,
    refreshing,
    error,
    retry: load,
    refresh: useCallback(() => load({ refresh: true }), [load]),
  };
}

