import { useCallback, useEffect, useState } from 'react';

import { fetchLatestTrainingSessions } from '../services/trainingSessionService';

export function useLatestTrainingSessions() {
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [sessionsError, setSessionsError] = useState(null);

  const loadSessions = useCallback(async () => {
    setLoadingSessions(true);
    setSessionsError(null);

    try {
      const data = await fetchLatestTrainingSessions(5);
      setSessions(data);
    } catch (e) {
      console.error('[Training Sessions] Load latest failed:', e);
      setSessionsError('Letzte Trainingseinheiten konnten nicht geladen werden.');
    } finally {
      setLoadingSessions(false);
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