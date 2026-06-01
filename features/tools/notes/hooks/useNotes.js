import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { getNotes, deleteNote, updateNote } from '../services/notesService';
import { getPreloadedToolData, setPreloadedToolData } from '../../../../lib/preloadedTools';

export function useNotes() {
  const preloadedNotes = getPreloadedToolData('notes');
  const [notes, setNotes] = useState(() => preloadedNotes ?? []);
  const [loading, setLoading] = useState(!preloadedNotes);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);

  const hasLoadedOnceRef = useRef(Boolean(preloadedNotes));
  const mountedRef = useRef(true);
  const loadRequestRef = useRef(0);
  const pendingActionsRef = useRef(new Set());

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      pendingActionsRef.current.clear();
    };
  }, []);

  const loadNotes = useCallback(async ({ silent = false } = {}) => {
    const requestId = loadRequestRef.current + 1;
    loadRequestRef.current = requestId;

    if (!silent) {
      setLoading(true);
    }

    setLoadError(null);

    try {
      const data = await getNotes();

      if (!mountedRef.current || requestId !== loadRequestRef.current) return;

      const safeNotes = Array.isArray(data) ? data : [];
      setNotes(safeNotes);
      setPreloadedToolData('notes', safeNotes);
      hasLoadedOnceRef.current = true;
    } catch (error) {
      console.log('[Notes] Load failed:', error);

      if (mountedRef.current && requestId === loadRequestRef.current) {
        setLoadError('Notizen konnten nicht geladen werden.');
      }
    } finally {
      if (mountedRef.current && requestId === loadRequestRef.current && !silent) {
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

      return () => {
        loadRequestRef.current += 1;
      };
    }, [loadNotes])
  );

  const removeNote = useCallback(
    async (id) => {
      if (!id) return;

      const actionKey = `delete:${id}`;
      if (pendingActionsRef.current.has(actionKey)) return;
      pendingActionsRef.current.add(actionKey);

      const previousNotes = notes;

      setNotes((current) => {
        const nextNotes = current.filter((note) => note.id !== id);
        setPreloadedToolData('notes', nextNotes);
        return nextNotes;
      });

      try {
        await deleteNote(id);
      } catch (error) {
        console.log('[Notes] Delete failed:', error);

        if (mountedRef.current) {
          setNotes(previousNotes);
          setPreloadedToolData('notes', previousNotes);
          setActionError('Notiz konnte nicht gelöscht werden.');
        }
      } finally {
        pendingActionsRef.current.delete(actionKey);
      }
    },
    [notes]
  );

  const togglePinned = useCallback(
    async (note) => {
      if (!note?.id) return;

      const actionKey = `pin:${note.id}`;
      if (pendingActionsRef.current.has(actionKey)) return;
      pendingActionsRef.current.add(actionKey);

      const nextPinned = !note.pinned;
      const previousNotes = notes;

      setNotes((current) => {
        const nextNotes = current
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
          });
        setPreloadedToolData('notes', nextNotes);
        return nextNotes;
      });

      try {
        await updateNote(note.id, { pinned: nextPinned });
      } catch (error) {
        console.log('[Notes] Pin failed:', error);

        if (mountedRef.current) {
          setNotes(previousNotes);
          setPreloadedToolData('notes', previousNotes);
          setActionError('Notiz konnte nicht angepinnt werden.');
        }
      } finally {
        pendingActionsRef.current.delete(actionKey);
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