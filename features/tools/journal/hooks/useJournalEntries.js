import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  getJournalEntries,
  addJournalEntry,
  updateJournalEntry,
  deleteJournalEntry,
} from '../services/journal';

export function useJournalEntries(selectedDate) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const data = await getJournalEntries();
      setEntries(data);
    } catch (e) {
      setLoadError('Journal konnte nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEntries();
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
    setEntries(prev => [createdEntry, ...prev]);
  }, []);

  const update = useCallback(async (id, payload) => {
    const previousEntries = entries;

    setEntries(prev => prev.map(entry => (
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
    )));

    try {
      const updatedEntry = await updateJournalEntry(id, payload);
      setEntries(prev => prev.map(entry => entry.id === id ? updatedEntry : entry));
    } catch (e) {
      setActionError('Journal-Eintrag konnte nicht aktualisiert werden.');
      setEntries(previousEntries);
      throw e;
    }
  }, [entries]);

  const remove = useCallback(async (id) => {
    const previousEntries = entries;
    setEntries(prev => prev.filter(entry => entry.id !== id));

    try {
      await deleteJournalEntry(id);
    } catch (e) {
      setActionError('Journal-Eintrag konnte nicht gelöscht werden.');
      setEntries(previousEntries);
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