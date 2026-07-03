import { logger } from '../../../../lib/logger';
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
import { getPreloadedToolData, setPreloadedToolData } from '../../../../lib/preloadedTools';

function sortAffirmations(items) {
  return [...items].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export function useAffirmations() {
  const preloadedAffirmations = getPreloadedToolData('affirmations');
  const [affirmations, setAffirmations] = useState(() => preloadedAffirmations ?? []);
  const [loading, setLoading] = useState(!preloadedAffirmations);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);

  const hasLoadedOnceRef = useRef(Boolean(preloadedAffirmations));

  const loadAffirmations = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setLoadError(null);

    try {
      const data = await getAffirmations();
      setAffirmations(data);
      setPreloadedToolData('affirmations', data);
      hasLoadedOnceRef.current = true;
    } catch (error) {
      logger.debug('[Affirmations] Load failed:', error);
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
        setAffirmations((current) => {
          const nextItems = [created, ...current];
          setPreloadedToolData('affirmations', nextItems);
          return nextItems;
        });
      }
      return created;
    } catch (error) {
      logger.debug('[Affirmations] Create failed:', error);
      setActionError('Affirmation konnte nicht gespeichert werden.');
      throw error;
    }
  }, []);

  const editAffirmation = useCallback(async (id, payload) => {
    const previous = affirmations;

    setAffirmations((current) => {
      const nextItems = current.map((item) =>
        item.id === id
          ? { ...item, ...payload, updated_at: new Date().toISOString() }
          : item
      );
      setPreloadedToolData('affirmations', nextItems);
      return nextItems;
    });

    try {
      const updated = await updateAffirmation(id, payload);
      setAffirmations((current) => {
        const nextItems = current.map((item) => (item.id === id ? updated : item));
        setPreloadedToolData('affirmations', nextItems);
        return nextItems;
      });
      return updated;
    } catch (error) {
      logger.debug('[Affirmations] Update failed:', error);
      setAffirmations(previous);
      setPreloadedToolData('affirmations', previous);
      setActionError('Affirmation konnte nicht aktualisiert werden.');
      throw error;
    }
  }, [affirmations]);

  const toggleRepeatedToday = useCallback(async (affirmation) => {
    const today = getTodayIsoDate();
    const wasRepeatedToday = affirmation.last_repeated_date === today;
    const shouldRepeat = !wasRepeatedToday;
    const previous = affirmations;

    setAffirmations((current) => {
      const nextItems = current.map((item) =>
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
      );
      setPreloadedToolData('affirmations', nextItems);
      return nextItems;
    });

    try {
      const updated = await setAffirmationRepeated(
        affirmation.id,
        shouldRepeat,
        affirmation.total_repetitions
      );

      setAffirmations((current) => {
        const nextItems = current.map((item) => (item.id === affirmation.id ? updated : item));
        setPreloadedToolData('affirmations', nextItems);
        return nextItems;
      });
    } catch (error) {
      logger.debug('[Affirmations] Repeat failed:', error);
      setAffirmations(previous);
      setPreloadedToolData('affirmations', previous);
      setActionError('Status konnte nicht gespeichert werden.');
    }
  }, [affirmations]);

  const removeAffirmation = useCallback(async (id) => {
    const previous = affirmations;

    setAffirmations((current) => {
      const nextItems = current.filter((item) => item.id !== id);
      setPreloadedToolData('affirmations', nextItems);
      return nextItems;
    });

    try {
      await deleteAffirmation(id);
    } catch (error) {
      logger.debug('[Affirmations] Delete failed:', error);
      setAffirmations(previous);
      setPreloadedToolData('affirmations', previous);
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