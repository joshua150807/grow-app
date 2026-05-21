import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { getNotes, deleteNote, updateNote } from '../services/notesService';

export function useNotes() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);

  const hasLoadedOnceRef = useRef(false);

  const loadNotes = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
    }

    setLoadError(null);

    try {
      const data = await getNotes();
      setNotes(data);
      hasLoadedOnceRef.current = true;
    } catch (error) {
      console.log('[Notes] Load failed:', error);
      setLoadError('Notizen konnten nicht geladen werden.');
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const shouldLoadSilently = hasLoadedOnceRef.current;

      loadNotes({
        silent: shouldLoadSilently,
      });
    }, [loadNotes])
  );

  const removeNote = useCallback(
    async (id) => {
      const previousNotes = notes;

      setNotes((current) => current.filter((note) => note.id !== id));

      try {
        await deleteNote(id);
      } catch (error) {
        console.log('[Notes] Delete failed:', error);
        setNotes(previousNotes);
        setActionError('Notiz konnte nicht gelöscht werden.');
      }
    },
    [notes]
  );

  const togglePinned = useCallback(
    async (note) => {
      const nextPinned = !note.pinned;
      const previousNotes = notes;

      setNotes((current) =>
        current
          .map((item) =>
            item.id === note.id
              ? {
                  ...item,
                  pinned: nextPinned,
                  updated_at: new Date().toISOString(),
                }
              : item
          )
          .sort((a, b) => {
            if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
            return new Date(b.updated_at) - new Date(a.updated_at);
          })
      );

      try {
        await updateNote(note.id, { pinned: nextPinned });
      } catch (error) {
        console.log('[Notes] Pin failed:', error);
        setNotes(previousNotes);
        setActionError('Notiz konnte nicht angepinnt werden.');
      }
    },
    [notes]
  );

  return {
    notes,
    loading,
    loadError,
    actionError,
    setActionError,
    loadNotes,
    removeNote,
    togglePinned,
  };
}