import { useCallback, useEffect, useRef, useState } from 'react';
import { getHabitCollection } from '../services/habitCollections';
import { getCompletionsForDate } from '../services/habits';
import { getCurrentUserId } from '../../../../services/authUser';
import { supabase } from '../../../../services/supabaseClient';
import { getDateForDayIndex, getTodayIndex } from '../utils/habitUtils';

function normalizeCollection(payload) {
  if (!payload || !payload.id) return null;
  return {
    id: payload.id,
    user_id: payload.user_id,
    name: typeof payload.name === 'string' ? payload.name : '',
    days: Array.isArray(payload.days) ? payload.days : [],
    version: Number(payload.version) || 1,
    created_at: payload.created_at,
    updated_at: payload.updated_at,
    members: Array.isArray(payload.members) ? payload.members : [],
  };
}

function normalizeIds(ids) {
  if (!Array.isArray(ids)) return [];
  return Array.from(new Set(ids.filter(Boolean)));
}

export function useHabitCollection(collectionId) {
  const safeCollectionId = typeof collectionId === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(collectionId)
    ? collectionId
    : null;
  const [collection, setCollection] = useState(null);
  const [completedIds, setCompletedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const mountedRef = useRef(true);
  const ownerRef = useRef(null);
  const loadRequestRef = useRef(0);
  const completionRequestRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    let authSequence = 0;

    const initOwner = async () => {
      const sequence = ++authSequence;
      try {
        const userId = await getCurrentUserId();
        if (!mountedRef.current || sequence !== authSequence) return;
        ownerRef.current = userId;
        if (!userId || !safeCollectionId) {
          setCollection(null);
          if (!safeCollectionId) setLoadError('Ungültige Sammlung.');
          setLoading(false);
          return;
        }
        await loadCollection();
        await loadCompletions();
      } catch (_error) {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    };

    const { data: { subscription } = {} } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        authSequence += 1;
        if (!mountedRef.current) return;
        const nextOwnerId = session?.user?.id ?? null;
        if (ownerRef.current !== nextOwnerId) {
          loadRequestRef.current += 1;
          completionRequestRef.current += 1;
          setCollection(null);
          setCompletedIds(new Set());
        }
        ownerRef.current = nextOwnerId;
        if (!nextOwnerId || !safeCollectionId) {
          if (!safeCollectionId) setLoadError('Ungültige Sammlung.');
          setLoading(false);
          return;
        }
        setLoading(true);
        await loadCollection();
        await loadCompletions();
      }
    );

    initOwner();

    return () => {
      mountedRef.current = false;
      authSequence += 1;
      loadRequestRef.current += 1;
      completionRequestRef.current += 1;
      subscription?.unsubscribe?.();
    };
  }, [safeCollectionId]);

  const loadCollection = useCallback(async () => {
    if (!safeCollectionId || !ownerRef.current) return;

    const requestId = ++loadRequestRef.current;
    if (mountedRef.current) setLoadError(null);

    try {
      const data = normalizeCollection(await getHabitCollection(safeCollectionId));
      if (!mountedRef.current || requestId !== loadRequestRef.current) return;
      setCollection(data);
    } catch (_error) {
      if (mountedRef.current && requestId === loadRequestRef.current) {
        setLoadError('Sammlung konnte nicht geladen werden.');
      }
    } finally {
      if (mountedRef.current && requestId === loadRequestRef.current) {
        setLoading(false);
      }
    }
  }, [safeCollectionId]);

  const loadCompletions = useCallback(async () => {
    if (!safeCollectionId || !ownerRef.current) return;

    const selectedDate = getDateForDayIndex(getTodayIndex());
    const requestId = ++completionRequestRef.current;

    try {
      const ids = normalizeIds(await getCompletionsForDate(selectedDate, ownerRef.current));
      if (!mountedRef.current || requestId !== completionRequestRef.current) return;
      setCompletedIds(new Set(ids));
    } catch (_error) {
      // Silent fail for completions
    }
  }, [safeCollectionId]);

  const reloadCompletions = useCallback(async () => {
    await loadCompletions();
  }, [loadCompletions]);

  return {
    collection,
    completedIds,
    loading,
    loadError,
    loadCollection,
    reloadCompletions,
  };
}
