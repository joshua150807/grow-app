import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  getJournalEntries,
  addJournalEntry,
  updateJournalEntry,
  deleteJournalEntry,
} from '../services/journal';
import { getPreloadedToolData, setPreloadedToolData } from '../../../../lib/preloadedTools';

export function useJournalEntries(selectedDate) {
  const preloadedJournalData = getPreloadedToolData('journal');
  const preloadedEntries = Array.isArray(preloadedJournalData)
    ? preloadedJournalData
    : preloadedJournalData?.entries;

  const [entries, setEntries] = useState(() => preloadedEntries ?? []);
  const [loading, setLoading] = useState(!preloadedEntries);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);

  const savePreloadedData = useCallback((nextEntries) => {
    setPreloadedToolData('journal', {
      entries: nextEntries,
    });
  }, []);

  const loadEntries = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
    }
    setLoadError(null);

    try {
      const entriesData = await getJournalEntries();
      setEntries(entriesData);
      savePreloadedData(entriesData);
    } catch (e) {
      setLoadError('Journal konnte nicht geladen werden.');
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [savePreloadedData]);

  useEffect(() => {
    loadEntries({ silent: Boolean(preloadedEntries) });
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

  const add = useCallback(async (payload) => {
    const createdEntry = await addJournalEntry(payload);
    setEntries(prev => {
      const nextEntries = [createdEntry, ...prev];
      savePreloadedData(nextEntries);
      return nextEntries;
    });
  }, [savePreloadedData]);

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
      savePreloadedData(nextEntries);
      return nextEntries;
    });

    try {
      const updatedEntry = await updateJournalEntry(id, payload);
      setEntries(prev => {
        const nextEntries = prev.map(entry => entry.id === id ? updatedEntry : entry);
        savePreloadedData(nextEntries);
        return nextEntries;
      });
    } catch (e) {
      setActionError('Journal-Eintrag konnte nicht aktualisiert werden.');
      setEntries(previousEntries);
      savePreloadedData(previousEntries);
      throw e;
    }
  }, [entries, savePreloadedData]);

  const remove = useCallback(async (id) => {
    const previousEntries = entries;
    setEntries(prev => {
      const nextEntries = prev.filter(entry => entry.id !== id);
      savePreloadedData(nextEntries);
      return nextEntries;
    });

    try {
      await deleteJournalEntry(id);
    } catch (e) {
      setActionError('Journal-Eintrag konnte nicht gelöscht werden.');
      setEntries(previousEntries);
      savePreloadedData(previousEntries);
    }
  }, [entries, savePreloadedData]);

  return {
    entries,
    visibleEntries,
    entriesByDate,
    loading,
    loadError,
    actionError,
    setActionError,
    loadEntries,
    add,
    update,
    remove,
  };
}
