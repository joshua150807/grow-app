import { useCallback, useEffect, useRef, useState } from 'react';

import {
  createNote,
  getNoteById,
  updateNote,
  deleteNote,
} from '../services/notesService';

import {
  isEmptyNote,
  normalizeNoteBody,
} from '../utils/noteTextUtils';
import { getPreloadedToolData, setPreloadedToolData } from '../../../../lib/preloadedTools';

const AUTOSAVE_DELAY_MS = 900;

export function useNoteEditor(noteId) {
  const preloadedNotes = getPreloadedToolData('notes') ?? [];
  const preloadedNote = noteId ? preloadedNotes.find((note) => note.id === noteId) : null;

  const [localNoteId, setLocalNoteId] = useState(noteId ?? null);
  const [body, setBody] = useState(preloadedNote?.body ?? '');
  const [initialBody, setInitialBody] = useState(preloadedNote?.body ?? '');
  const [noteMeta, setNoteMeta] = useState(preloadedNote ?? null);
  const [loading, setLoading] = useState(Boolean(noteId && !preloadedNote));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const saveTimerRef = useRef(null);
  const latestBodyRef = useRef('');
  const hasLoadedRef = useRef(!noteId || Boolean(preloadedNote));

  latestBodyRef.current = body;

  const clearSaveTimer = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadNote() {
      if (!noteId) return;

      if (!preloadedNote) {
        setLoading(true);
      }
      setError(null);

      try {
        const note = await getNoteById(noteId);

        if (!mounted) return;

        if (!note) {
          setError('Notiz wurde nicht gefunden.');
          return;
        }

        setLocalNoteId(note.id);
        setBody(note.body ?? '');
        setInitialBody(note.body ?? '');
        setNoteMeta(note);
        const existingNotes = getPreloadedToolData('notes') ?? [];
        const nextNotes = existingNotes.some((item) => item.id === note.id)
          ? existingNotes.map((item) => (item.id === note.id ? note : item))
          : [note, ...existingNotes];
        setPreloadedToolData('notes', nextNotes);
        hasLoadedRef.current = true;
      } catch (loadError) {
        console.log('[NoteEditor] Load failed:', loadError);

        if (mounted) {
          setError('Notiz konnte nicht geladen werden.');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadNote();

    return () => {
      mounted = false;
      clearSaveTimer();
    };
  }, [noteId, clearSaveTimer]);

  const saveNow = useCallback(async (value = latestBodyRef.current) => {
    const cleanBody = normalizeNoteBody(value);

    if (!hasLoadedRef.current && noteId) return null;

    if (!localNoteId && isEmptyNote(cleanBody)) {
      return null;
    }

    if (localNoteId && cleanBody === initialBody) {
      return null;
    }

    setSaving(true);
    setError(null);

    try {
      if (!localNoteId) {
        const createdNote = await createNote({ body: cleanBody });

        if (createdNote) {
          setLocalNoteId(createdNote.id);
          setInitialBody(createdNote.body ?? '');
          setNoteMeta(createdNote);
          setPreloadedToolData('notes', [createdNote, ...(getPreloadedToolData('notes') ?? [])]);
        }

        return createdNote;
      }

      const updatedNote = await updateNote(localNoteId, { body: cleanBody });

      setInitialBody(updatedNote.body ?? '');
      setNoteMeta(updatedNote);
      const existingNotes = getPreloadedToolData('notes') ?? [];
      setPreloadedToolData('notes', existingNotes.map((item) => (item.id === updatedNote.id ? updatedNote : item)));

      return updatedNote;
    } catch (saveError) {
      console.log('[NoteEditor] Save failed:', saveError);
      setError('Notiz konnte nicht gespeichert werden.');
      throw saveError;
    } finally {
      setSaving(false);
    }
  }, [initialBody, localNoteId, noteId]);

  const scheduleSave = useCallback((nextBody) => {
    clearSaveTimer();

    if (isEmptyNote(nextBody) && !localNoteId) {
      return;
    }

    saveTimerRef.current = setTimeout(() => {
      saveNow(nextBody).catch(() => {});
    }, AUTOSAVE_DELAY_MS);
  }, [clearSaveTimer, localNoteId, saveNow]);

  const updateBody = useCallback((nextBody) => {
    setBody(nextBody);
    scheduleSave(nextBody);
  }, [scheduleSave]);

  const flushSave = useCallback(async () => {
    clearSaveTimer();
    return saveNow(latestBodyRef.current);
  }, [clearSaveTimer, saveNow]);

  const removeCurrentNote = useCallback(async () => {
    clearSaveTimer();

    if (!localNoteId) return;

    await deleteNote(localNoteId);
    setPreloadedToolData('notes', (getPreloadedToolData('notes') ?? []).filter((note) => note.id !== localNoteId));
  }, [clearSaveTimer, localNoteId]);

  return {
    noteId: localNoteId,
    body,
    noteMeta,
    loading,
    saving,
    error,
    updateBody,
    flushSave,
    removeCurrentNote,
  };
}