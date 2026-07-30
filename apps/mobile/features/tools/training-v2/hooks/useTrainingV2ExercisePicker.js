import { useCallback, useRef, useState } from 'react';

import { listTrainingV2Exercises } from '../services/trainingV2Api';
import { normalizeExerciseName } from '../utils/trainingV2ExerciseName';

// A private and a system exercise can share a normalized name at the same time (e.g. the
// user renamed their own copy back to the original) — the private one must always win so
// confirming never silently rebinds a row to someone else's system exercise.
function findExactMatch(exercises, normalizedQuery) {
  const matches = exercises.filter((exercise) => normalizeExerciseName(exercise.name) === normalizedQuery);
  if (matches.length === 0) return null;
  return matches.find((exercise) => exercise.scope === 'user') ?? matches[0];
}

export function useTrainingV2ExercisePicker() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [exactMatch, setExactMatch] = useState(null);
  const requestSequenceRef = useRef(0);

  // Returns the freshly resolved { results, exactMatch } directly (not just via state), so a
  // caller that needs an up-to-date answer right now (the picker's confirm action) never has
  // to trust potentially-stale debounced state from a live-typing search still in flight.
  const search = useCallback(async (query) => {
    const requestSequence = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestSequence;
    setLoading(true);
    setError(null);

    try {
      const response = await listTrainingV2Exercises(query);
      const normalizedQuery = normalizeExerciseName(query.search ?? '');
      let resolvedExactMatch = null;
      if (normalizedQuery) {
        const matchInFiltered = findExactMatch(response.exercises, normalizedQuery);
        if (matchInFiltered || query.category === undefined) {
          resolvedExactMatch = matchInFiltered;
        } else {
          // An active category filter can hide an exact match that exists under a
          // different category — re-check without it before offering to create a
          // duplicate-looking private exercise.
          const unfiltered = await listTrainingV2Exercises({ search: query.search });
          resolvedExactMatch = findExactMatch(unfiltered.exercises, normalizedQuery);
        }
      }

      if (requestSequence === requestSequenceRef.current) {
        setResults(response.exercises);
        setExactMatch(resolvedExactMatch);
      }
      return { results: response.exercises, exactMatch: resolvedExactMatch };
    } catch (nextError) {
      if (requestSequence === requestSequenceRef.current) {
        setError(nextError);
        setResults([]);
        setExactMatch(null);
      }
      return { results: [], exactMatch: null, error: nextError };
    } finally {
      if (requestSequence === requestSequenceRef.current) setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    requestSequenceRef.current += 1;
    setResults([]);
    setError(null);
    setExactMatch(null);
    setLoading(false);
  }, []);

  return {
    results, loading, error, exactMatch, search, reset,
  };
}
