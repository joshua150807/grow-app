import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { getTrainingV2Session, getTrainingV2SessionStats, listTrainingV2Sessions } from '../services/trainingV2Api';

const PAGE_SIZE = 20;
const RECENT_SESSION_COUNT = 3;
const readPage = (page) => listTrainingV2Sessions({ page, limit: PAGE_SIZE });
const initialState = { data: null, loading: true, refreshing: false, fetching: false, loadingMore: false, error: null, moreError: null };

// Keep the pagination cursor with its result and invalidate all in-flight work on blur or reload.
export function createHistoryRequest(load, publish, append) {
  let state = initialState;
  let focused = false;
  let generation = 0;

  function update(patch) {
    state = { ...state, ...patch };
    publish(state);
  }

  async function refresh(pull = false) {
    if (!focused) return;
    // Native Pressable passes an event to retry; only explicit true means pull.
    pull = pull === true;
    const request = ++generation;
    const previous = state.data;
    const lastVisiblePage = !pull && append ? previous?.pagination?.page ?? 0 : 0;
    update({ loading: previous === null, refreshing: pull, fetching: previous !== null && !pull, loadingMore: false, error: null, moreError: null });
    try {
      let data = await load(() => request === generation);
      // Returning from a detail must not remove already visible later pages (and
      // collapse the list/scroll offset). Publish the refreshed window together.
      for (let page = 1; page <= lastVisiblePage && data.pagination.hasMore && request === generation; page += 1) {
        data = append(data, await readPage(page));
      }
      if (request === generation) update({ data });
    } catch (error) {
      if (request === generation) update({ error });
    } finally {
      if (request === generation) update({ loading: false, refreshing: false, fetching: false });
    }
  }

  return {
    focus() {
      focused = true;
      void refresh();
      return () => {
        focused = false;
        generation += 1;
      };
    },
    refresh,
    async loadMore() {
      if (!focused || state.loading || state.refreshing || state.fetching || state.loadingMore || !state.data?.pagination?.hasMore) return;
      const request = generation;
      update({ loadingMore: true, moreError: null });
      try {
        const next = await readPage(state.data.pagination.page + 1);
        if (request === generation) update({ data: append(state.data, next) });
      } catch (moreError) {
        if (request === generation) update({ moreError });
      } finally {
        if (request === generation) update({ loadingMore: false });
      }
    },
  };
}

function useHistoryRequest(load, append) {
  const [result, setResult] = useState(null);
  const request = useMemo(() => {
    return createHistoryRequest(load, (state) => setResult({ load, state }), append);
  }, [load, append]);
  useFocusEffect(request.focus);
  return {
    ...(result?.load === load ? result.state : initialState),
    retry: request.refresh,
    refresh: () => request.refresh(true),
    loadMore: request.loadMore,
  };
}

export async function loadRecentCompletedSessions(isCurrent = () => true) {
  const sessions = new Map();
  let page = 0;
  while (isCurrent() && sessions.size < RECENT_SESSION_COUNT) {
    const result = await readPage(page);
    for (const session of result.sessions) {
      if (session.status === 'completed' && !sessions.has(session.id)) sessions.set(session.id, session);
      if (sessions.size === RECENT_SESSION_COUNT) break;
    }
    if (!result.pagination.hasMore) break;
    page = result.pagination.page + 1;
  }
  return [...sessions.values()];
}

function loadFirstPage() {
  return readPage(0);
}

export function appendHistoryPage(previous, next) {
  const sessions = new Map(previous.sessions.map((session) => [session.id, session]));
  for (const session of next.sessions) sessions.set(session.id, session);
  return { ...next, sessions: [...sessions.values()] };
}

export function useTrainingV2RecentSessions() {
  return useHistoryRequest(loadRecentCompletedSessions);
}

export function useTrainingV2History() {
  return useHistoryRequest(loadFirstPage, appendHistoryPage);
}

export function useTrainingV2HistoryStats() {
  return useHistoryRequest(getTrainingV2SessionStats);
}

export function useTrainingV2HistoryDetail(sessionId) {
  const load = useCallback(() => {
    if (!sessionId) throw new Error('Die Trainings-ID fehlt.');
    return getTrainingV2Session(sessionId);
  }, [sessionId]);
  return useHistoryRequest(load);
}
