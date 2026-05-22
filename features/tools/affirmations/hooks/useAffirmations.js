import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import {
  getAffirmations,
  createAffirmation,
  updateAffirmation,
  setAffirmationRepeated,
  deleteAffirmation,
} from '../services/affirmations';
import { getTodayIsoDate } from '../utils/affirmationUtils';

function sortAffirmations(items) {
  return [...items].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export function useAffirmations() {
  const [affirmations, setAffirmations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);

  const hasLoadedOnceRef = useRef(false);

  const loadAffirmations = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setLoadError(null);

    try {
      const data = await getAffirmations();
      setAffirmations(data);
      hasLoadedOnceRef.current = true;
    } catch (error) {
      console.log('[Affirmations] Load failed:', error);
      setLoadError('Affirmationen konnten nicht geladen werden.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAffirmations({ silent: hasLoadedOnceRef.current });
    }, [loadAffirmations])
  );

  const addAffirmation = useCallback(async ({ text, category }) => {
    try {
      const created = await createAffirmation({ text, category });
      if (created) {
        setAffirmations((current) => [created, ...current]);
      }
      return created;
    } catch (error) {
      console.log('[Affirmations] Create failed:', error);
      setActionError('Affirmation konnte nicht gespeichert werden.');
      throw error;
    }
  }, []);

  const editAffirmation = useCallback(async (id, payload) => {
    const previous = affirmations;

    setAffirmations((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, ...payload, updated_at: new Date().toISOString() }
          : item
      )
    );

    try {
      const updated = await updateAffirmation(id, payload);
      setAffirmations((current) =>
        current.map((item) => (item.id === id ? updated : item))
      );
      return updated;
    } catch (error) {
      console.log('[Affirmations] Update failed:', error);
      setAffirmations(previous);
      setActionError('Affirmation konnte nicht aktualisiert werden.');
      throw error;
    }
  }, [affirmations]);

  const toggleRepeatedToday = useCallback(async (affirmation) => {
    const today = getTodayIsoDate();
    const wasRepeatedToday = affirmation.last_repeated_date === today;
    const shouldRepeat = !wasRepeatedToday;
    const previous = affirmations;

    setAffirmations((current) =>
      current.map((item) =>
        item.id === affirmation.id
          ? {
              ...item,
              last_repeated_date: shouldRepeat ? today : null,
              total_repetitions: shouldRepeat
                ? Number(item.total_repetitions || 0) + 1
                : Number(item.total_repetitions || 0),
              updated_at: new Date().toISOString(),
            }
          : item
      )
    );

    try {
      const updated = await setAffirmationRepeated(
        affirmation.id,
        shouldRepeat,
        affirmation.total_repetitions
      );

      setAffirmations((current) =>
        current.map((item) => (item.id === affirmation.id ? updated : item))
      );
    } catch (error) {
      console.log('[Affirmations] Repeat failed:', error);
      setAffirmations(previous);
      setActionError('Status konnte nicht gespeichert werden.');
    }
  }, [affirmations]);

  const removeAffirmation = useCallback(async (id) => {
    const previous = affirmations;

    setAffirmations((current) => current.filter((item) => item.id !== id));

    try {
      await deleteAffirmation(id);
    } catch (error) {
      console.log('[Affirmations] Delete failed:', error);
      setAffirmations(previous);
      setActionError('Affirmation konnte nicht gelöscht werden.');
    }
  }, [affirmations]);

  return {
    affirmations: sortAffirmations(affirmations),
    loading,
    loadError,
    actionError,
    setActionError,
    loadAffirmations,
    addAffirmation,
    editAffirmation,
    toggleRepeatedToday,
    removeAffirmation,
  };
}
