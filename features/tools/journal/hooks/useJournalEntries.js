import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  getJournalEntries,
  getJournalStarterEntries,
  addJournalEntry,
  updateJournalEntry,
  deleteJournalEntry,
  upsertJournalStarterEntry,
} from '../services/journal';
import { getPreloadedToolData, setPreloadedToolData } from '../../../../lib/preloadedTools';

export function useJournalEntries(selectedDate) {
  const preloadedJournalData = getPreloadedToolData('journal');
  const preloadedEntries = Array.isArray(preloadedJournalData)
    ? preloadedJournalData
    : preloadedJournalData?.entries;
  const preloadedStarterEntries = Array.isArray(preloadedJournalData)
    ? null
    : preloadedJournalData?.starterEntries;

  const [entries, setEntries] = useState(() => preloadedEntries ?? []);
  const [starterEntries, setStarterEntries] = useState(() => preloadedStarterEntries ?? []);
  const [loading, setLoading] = useState(!preloadedEntries || !preloadedStarterEntries);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);

  const savePreloadedData = useCallback((nextEntries, nextStarterEntries) => {
    setPreloadedToolData('journal', {
      entries: nextEntries,
      starterEntries: nextStarterEntries,
    });
  }, []);

  const loadEntries = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
    }
    setLoadError(null);

    try {
      const [entriesData, starterData] = await Promise.all([
        getJournalEntries(),
        getJournalStarterEntries(),
      ]);

      setEntries(entriesData);
      setStarterEntries(starterData);
      savePreloadedData(entriesData, starterData);
    } catch (e) {
      setLoadError('Journal konnte nicht geladen werden.');
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [savePreloadedData]);

  useEffect(() => {
    loadEntries({ silent: Boolean(preloadedEntries && preloadedStarterEntries) });
  }, [loadEntries]);

  const visibleEntries = useMemo(
    () => entries.filter(entry => entry.entry_date === selectedDate),
    [entries, selectedDate]
  );

  const entriesByDate = useMemo(() => {
    return entries.reduce((acc, entry) => {
      acc[entry.entry_date] = (acc[entry.entry_date] || 0) + 1;
      return acc;
    }, {});
  }, [entries]);

  const starterEntriesByKey = useMemo(() => {
    return starterEntries.reduce((acc, entry) => {
      acc[entry.page_key] = entry;
      return acc;
    }, {});
  }, [starterEntries]);

  const add = useCallback(async (payload) => {
    const createdEntry = await addJournalEntry(payload);
    setEntries(prev => {
      const nextEntries = [createdEntry, ...prev];
      savePreloadedData(nextEntries, starterEntries);
      return nextEntries;
    });
  }, [savePreloadedData, starterEntries]);

  const update = useCallback(async (id, payload) => {
    const previousEntries = entries;

    setEntries(prev => {
      const nextEntries = prev.map(entry => (
        entry.id === id
          ? {
              ...entry,
              gratitude: payload.gratitude,
              did_well: payload.didWell,
              improve_tomorrow: payload.improveTomorrow,
              habits_completed: payload.habitsCompleted,
              missed_habits: payload.habitsCompleted ? null : payload.missedHabits,
            }
          : entry
      ));
      savePreloadedData(nextEntries, starterEntries);
      return nextEntries;
    });

    try {
      const updatedEntry = await updateJournalEntry(id, payload);
      setEntries(prev => {
        const nextEntries = prev.map(entry => entry.id === id ? updatedEntry : entry);
        savePreloadedData(nextEntries, starterEntries);
        return nextEntries;
      });
    } catch (e) {
      setActionError('Journal-Eintrag konnte nicht aktualisiert werden.');
      setEntries(previousEntries);
      savePreloadedData(previousEntries, starterEntries);
      throw e;
    }
  }, [entries, savePreloadedData, starterEntries]);

  const saveStarterPage = useCallback(async ({ pageKey, answer }) => {
    const previousStarterEntries = starterEntries;
    const optimisticEntry = {
      id: `starter-${pageKey}`,
      page_key: pageKey,
      answer,
      updated_at: new Date().toISOString(),
    };

    setStarterEntries(prev => {
      const exists = prev.some(entry => entry.page_key === pageKey);
      const nextStarterEntries = exists
        ? prev.map(entry => entry.page_key === pageKey ? { ...entry, answer } : entry)
        : [...prev, optimisticEntry];
      savePreloadedData(entries, nextStarterEntries);
      return nextStarterEntries;
    });

    try {
      const savedEntry = await upsertJournalStarterEntry({ pageKey, answer });
      setStarterEntries(prev => {
        const exists = prev.some(entry => entry.page_key === pageKey);
        const nextStarterEntries = exists
          ? prev.map(entry => entry.page_key === pageKey ? savedEntry : entry)
          : [...prev, savedEntry];
        savePreloadedData(entries, nextStarterEntries);
        return nextStarterEntries;
      });
    } catch (e) {
      setActionError('Startseite konnte nicht gespeichert werden.');
      setStarterEntries(previousStarterEntries);
      savePreloadedData(entries, previousStarterEntries);
      throw e;
    }
  }, [entries, savePreloadedData, starterEntries]);

  const remove = useCallback(async (id) => {
    const previousEntries = entries;
    setEntries(prev => {
      const nextEntries = prev.filter(entry => entry.id !== id);
      savePreloadedData(nextEntries, starterEntries);
      return nextEntries;
    });

    try {
      await deleteJournalEntry(id);
    } catch (e) {
      setActionError('Journal-Eintrag konnte nicht gelöscht werden.');
      setEntries(previousEntries);
      savePreloadedData(previousEntries, starterEntries);
    }
  }, [entries, savePreloadedData, starterEntries]);

  return {
    entries,
    visibleEntries,
    entriesByDate,
    starterEntries,
    starterEntriesByKey,
    loading,
    loadError,
    actionError,
    setActionError,
    loadEntries,
    add,
    update,
    saveStarterPage,
    remove,
  };
}
