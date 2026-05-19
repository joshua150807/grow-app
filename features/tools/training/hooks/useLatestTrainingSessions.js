import { useCallback, useEffect, useState } from 'react';

import { fetchLatestTrainingSessions } from '../services/trainingSessionService';

export function useLatestTrainingSessions() {
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [sessionsError, setSessionsError] = useState(null);

  const loadSessions = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoadingSessions(true);
    }

    setSessionsError(null);

    try {
      const data = await fetchLatestTrainingSessions();
      setSessions(data);
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
    loadSessions();
  }, [loadSessions]);

  return {
    sessions,
    loadingSessions,
    sessionsError,
    loadSessions,
  };
}