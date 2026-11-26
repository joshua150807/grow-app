import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { getTrainingV2ExerciseProgress, getTrainingV2Progress, getTrainingV2Records } from '../services/trainingV2Api';

const initial = { data: null, loading: true, refreshing: false, fetching: false, error: null, loadingMore: false, moreError: null };
export function createTrainingAnalyticsRequest(read, publish, collection) {
  let state = initial, focused = false, generation = 0;
  const update = patch => { state = { ...state, ...patch }; publish(state); };
  const merge = (first, next) => {
    const identity = collection === 'points' ? 'sessionId' : 'exerciseId';
    const values = new Map(first[collection].map(value => [value[identity], value]));
    for (const value of next[collection]) values.set(value[identity], value);
    return { ...next, [collection]: [...values.values()] };
  };
  async function refresh(pull = false) {
    if (!focused) return;
    const token = ++generation, pages = collection ? state.data?.pagination.page ?? 0 : 0;
    update({ loading: !state.data, refreshing: pull === true, fetching: Boolean(state.data), loadingMore: false, error: null, moreError: null });
    try {
      let data = await read(0);
      for (let page = 1; collection && page <= pages && data.pagination.hasMore && token === generation; page += 1) data = merge(data, await read(page));
      if (token === generation) update({ data });
    } catch (error) { if (token === generation) update({ error }); }
    finally { if (token === generation) update({ loading: false, refreshing: false, fetching: false }); }
  }
  return {
    focus() { focused = true; void refresh(); return () => { focused = false; generation += 1; }; }, refresh,
    async loadMore() {
      if (!focused || !collection || state.fetching || state.loadingMore || !state.data?.pagination.hasMore) return;
      const token = generation; update({ loadingMore: true, moreError: null });
      try { const next = await read(state.data.pagination.page + 1); if (token === generation) update({ data: merge(state.data, next) }); }
      catch (moreError) { if (token === generation) update({ moreError }); }
      finally { if (token === generation) update({ loadingMore: false }); }
    },
  };
}
export function useTrainingAnalyticsResource(read, collection) {
  const [result, setResult] = useState(null);
  const request = useMemo(() => createTrainingAnalyticsRequest(read, state => setResult({ read, state }), collection), [read, collection]);
  useFocusEffect(request.focus);
  return { ...(result?.read === read ? result.state : initial), retry: request.refresh, refresh: () => request.refresh(true), loadMore: request.loadMore };
}
export function trainingDeviceTimeZone() { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; } }
export function useTrainingRecords(search) {
  const read = useCallback(page => getTrainingV2Records({ search, page }), [search]);
  return useTrainingAnalyticsResource(read, 'exercises');
}
export function useTrainingProgress(period, timeZone) {
  const read = useCallback(() => getTrainingV2Progress({ period, timeZone }), [period, timeZone]);
  return useTrainingAnalyticsResource(read);
}
export function useTrainingExerciseProgress(exerciseId, period, timeZone) {
  const read = useCallback(page => getTrainingV2ExerciseProgress(exerciseId, { period, timeZone, page }), [exerciseId, period, timeZone]);
  return useTrainingAnalyticsResource(read, 'points');
}
