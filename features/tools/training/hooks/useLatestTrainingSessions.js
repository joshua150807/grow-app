import { useCallback, useEffect, useState } from 'react';

import { fetchLatestTrainingSessions } from '../services/trainingSessionService';
import { getPreloadedToolData, setPreloadedToolData } from '../../../../lib/preloadedTools';

export function useLatestTrainingSessions() {
  const preloadedSessions = getPreloadedToolData('trainingSessions');
  const [sessions, setSessions] = useState(() => preloadedSessions ?? []);
  const [loadingSessions, setLoadingSessions] = useState(!preloadedSessions);
  const [sessionsError, setSessionsError] = useState(null);

  const loadSessions = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoadingSessions(true);
    }

    setSessionsError(null);

    try {
      const data = await fetchLatestTrainingSessions();
      setSessions(data);
      setPreloadedToolData('trainingSessions', data);
    } catch (e) {
      console.error('[Training Sessions] Load failed:', e);
      setSessionsError('Trainingseinheiten konnten nicht geladen werden.');
    } finally {
      if (!silent) {
        setLoadingSessions(false);
      }
    }
  }, []);

  useEffect(() => {
    loadSessions({ silent: Boolean(preloadedSessions) });
  }, [loadSessions]);

  return {
    sessions,
    loadingSessions,
    sessionsError,
    loadSessions,
  };
}