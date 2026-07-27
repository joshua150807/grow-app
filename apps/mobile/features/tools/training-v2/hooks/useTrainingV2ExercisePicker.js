import { useCallback, useRef, useState } from 'react';

import { listTrainingV2Exercises } from '../services/trainingV2Api';

export function useTrainingV2ExercisePicker() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const requestSequenceRef = useRef(0);

  const search = useCallback(async (query) => {
    const requestSequence = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestSequence;
    setLoading(true);
    setError(null);

    try {
      const response = await listTrainingV2Exercises(query);
      if (requestSequence !== requestSequenceRef.current) return;
      setResults(response.exercises);
    } catch (nextError) {
      if (requestSequence !== requestSequenceRef.current) return;
      setError(nextError);
      setResults([]);
    } finally {
      if (requestSequence !== requestSequenceRef.current) return;
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    requestSequenceRef.current += 1;
    setResults([]);
    setError(null);
    setLoading(false);
  }, []);

  return { results, loading, error, search, reset };
}
