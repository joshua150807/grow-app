import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  getJournalEntries,
  addJournalEntry,
  updateJournalEntry,
  deleteJournalEntry,
} from '../services/journal';
import { getPreloadedToolData, setPreloadedToolData } from '../../../../lib/preloadedTools';

export function useJournalEntries(selectedDate) {
  const preloadedEntries = getPreloadedToolData('journal');
  const [entries, setEntries] = useState(() => preloadedEntries ?? []);
  const [loading, setLoading] = useState(!preloadedEntries);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);

  const loadEntries = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
    }
    setLoadError(null);

    try {
      const data = await getJournalEntries();
      setEntries(data);
      setPreloadedToolData('journal', data);
    } catch (e) {
      setLoadError('Journal konnte nicht geladen werden.');
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

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
      setPreloadedToolData('journal', nextEntries);
      return nextEntries;
    });
  }, []);

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
      setPreloadedToolData('journal', nextEntries);
      return nextEntries;
    });

    try {
      const updatedEntry = await updateJournalEntry(id, payload);
      setEntries(prev => {
        const nextEntries = prev.map(entry => entry.id === id ? updatedEntry : entry);
        setPreloadedToolData('journal', nextEntries);
        return nextEntries;
      });
    } catch (e) {
      setActionError('Journal-Eintrag konnte nicht aktualisiert werden.');
      setEntries(previousEntries);
      setPreloadedToolData('journal', previousEntries);
      throw e;
    }
  }, [entries]);

  const remove = useCallback(async (id) => {
    const previousEntries = entries;
    setEntries(prev => {
      const nextEntries = prev.filter(entry => entry.id !== id);
      setPreloadedToolData('journal', nextEntries);
      return nextEntries;
    });

    try {
      await deleteJournalEntry(id);
    } catch (e) {
      setActionError('Journal-Eintrag konnte nicht gelöscht werden.');
      setEntries(previousEntries);
      setPreloadedToolData('journal', previousEntries);
    }
  }, [entries]);

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