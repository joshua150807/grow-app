import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  getHabits,
  getCompletionsForDate,
  toggleCompletion,
  deleteHabit,
  addHabit,
  updateHabit,
} from '../../../tools/habits/services/habits';
import { getCurrentUserId } from '../../../../services/authUser';
import { supabase } from '../../../../services/supabaseClient';
import { getDateForDayIndex } from '../utils/habitUtils';
import {
  getHabitCompletionsCacheKey,
  getHabitPendingCacheKey,
  getHabitsCacheKey,
  getOwnerCache,
  isCurrentOwnerRequest,
  ownsHabit,
  setOwnerCache,
  subscribeToOwnerCache,
} from '../services/habitCache';

function normalizeDays(days) {
  if (!Array.isArray(days)) return [];
  return Array.from(new Set(days
    .map(day => Number(day))
    .filter(day => Number.isInteger(day) && day >= 0 && day <= 6)
  )).sort((a, b) => a - b);
}

function normalizeHabit(habit) {
  if (!habit || !habit.id) return null;
  const days = normalizeDays(habit.days);
  if (days.length === 0) return null;
  return {
    ...habit,
    name: typeof habit.name === 'string' ? habit.name : '',
    days,
  };
}

function normalizeHabits(habits) {
  if (!Array.isArray(habits)) return [];
  return habits.map(normalizeHabit).filter(Boolean);
}

function normalizeIds(ids) {
  if (!Array.isArray(ids)) return [];
  return Array.from(new Set(ids.filter(Boolean)));
}

function normalizeLinkedTool(linkedTool = null) {
  return linkedTool?.id && linkedTool?.title && linkedTool?.route
    ? { id: linkedTool.id, title: linkedTool.title, route: linkedTool.route }
    : null;
}

function getPendingCompletionMutations(userId, localDate) {
  return getOwnerCache(getHabitPendingCacheKey(userId, localDate)) ?? {};
}

function setPendingCompletionMutation(userId, localDate, habitId, isDone) {
  if (!habitId) return;
  setOwnerCache(getHabitPendingCacheKey(userId, localDate), {
    ...getPendingCompletionMutations(userId, localDate),
    [habitId]: Boolean(isDone),
  });
}

function clearPendingCompletionMutation(userId, localDate, habitId) {
  if (!habitId) return;
  const current = { ...getPendingCompletionMutations(userId, localDate) };
  delete current[habitId];
  setOwnerCache(getHabitPendingCacheKey(userId, localDate), current);
}

function applyPendingCompletionMutations(ids, userId, localDate) {
  const next = new Set(normalizeIds(ids));
  const pending = getPendingCompletionMutations(userId, localDate);
  Object.entries(pending).forEach(([habitId, isDone]) => {
    if (isDone) next.add(habitId);
    else next.delete(habitId);
  });
  return Array.from(next);
}

export function useHabits(selectedDay) {
  const selectedDate = getDateForDayIndex(selectedDay);
  const [ownerUserId, setOwnerUserId] = useState(null);
  const [habits, setHabits] = useState([]);
  const [completedIds, setCompletedIds] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const mountedRef = useRef(true);
  const ownerRef = useRef(null);
  const habitsRef = useRef([]);
  const selectedDateRef = useRef(selectedDate);
  const habitsRequestRef = useRef(0);
  const completionsRequestRef = useRef(0);
  const pendingActionsRef = useRef(new Set());
  const completionWorkersRef = useRef(new Map());

  selectedDateRef.current = selectedDate;

  const activateOwner = useCallback((nextOwnerId) => {
    const safeOwnerId = nextOwnerId || null;
    ownerRef.current = safeOwnerId;
    habitsRequestRef.current += 1;
    completionsRequestRef.current += 1;
    pendingActionsRef.current.clear();
    setOwnerUserId(safeOwnerId);
    setLoadError(null);
    setActionError(null);

    if (!safeOwnerId) {
      habitsRef.current = [];
      setHabits([]);
      setCompletedIds(new Set());
      setLoading(false);
      return;
    }

    const cachedHabits = normalizeHabits(getOwnerCache(getHabitsCacheKey(safeOwnerId)) ?? []);
    const localDate = selectedDateRef.current;
    const cachedCompletions = applyPendingCompletionMutations(
      getOwnerCache(getHabitCompletionsCacheKey(safeOwnerId, localDate)) ?? [],
      safeOwnerId,
      localDate
    );
    habitsRef.current = cachedHabits;
    setHabits(cachedHabits);
    setCompletedIds(new Set(cachedCompletions));
    setLoading(getOwnerCache(getHabitsCacheKey(safeOwnerId)) === null);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    let authSequence = 0;

    const resolveInitialOwner = async () => {
      const sequence = ++authSequence;
      try {
        const userId = await getCurrentUserId();
        if (mountedRef.current && sequence === authSequence) activateOwner(userId);
      } catch (_error) {
        if (mountedRef.current && sequence === authSequence) activateOwner(null);
      }
    };

    const { data: { subscription } = {} } = supabase.auth.onAuthStateChange((_event, session) => {
      authSequence += 1;
      if (mountedRef.current) activateOwner(session?.user?.id ?? null);
    });
    resolveInitialOwner();

    return () => {
      mountedRef.current = false;
      authSequence += 1;
      habitsRequestRef.current += 1;
      completionsRequestRef.current += 1;
      pendingActionsRef.current.clear();
      subscription?.unsubscribe?.();
    };
  }, [activateOwner]);

  const loadHabits = useCallback(async ({ silent = false } = {}) => {
    const requestOwnerId = ownerRef.current;
    if (!requestOwnerId) return;
    const requestId = ++habitsRequestRef.current;

    if (mountedRef.current) {
      if (!silent) setLoading(true);
      setLoadError(null);
    }

    try {
      const data = normalizeHabits(await getHabits(requestOwnerId));
      if (!mountedRef.current || !isCurrentOwnerRequest(
        ownerRef.current, requestOwnerId, habitsRequestRef.current, requestId
      )) return;
      habitsRef.current = data;
      setHabits(data);
      setOwnerCache(getHabitsCacheKey(requestOwnerId), data);
    } catch (_error) {
      if (mountedRef.current && isCurrentOwnerRequest(
        ownerRef.current, requestOwnerId, habitsRequestRef.current, requestId
      )) setLoadError('Gewohnheiten konnten nicht geladen werden.');
    } finally {
      if (mountedRef.current && !silent && isCurrentOwnerRequest(
        ownerRef.current, requestOwnerId, habitsRequestRef.current, requestId
      )) setLoading(false);
    }
  }, []);

  const loadCompletions = useCallback(async () => {
    const requestOwnerId = ownerRef.current;
    const requestDate = selectedDate;
    if (!requestOwnerId) return;
    const requestId = ++completionsRequestRef.current;
    try {
      const ids = applyPendingCompletionMutations(
        await getCompletionsForDate(requestDate, requestOwnerId),
        requestOwnerId,
        requestDate
      );
      if (!mountedRef.current || selectedDateRef.current !== requestDate || !isCurrentOwnerRequest(
        ownerRef.current, requestOwnerId, completionsRequestRef.current, requestId
      )) return;
      setCompletedIds(new Set(ids));
      setOwnerCache(getHabitCompletionsCacheKey(requestOwnerId, requestDate), ids);
    } catch (_error) {
      if (mountedRef.current && selectedDateRef.current === requestDate && isCurrentOwnerRequest(
        ownerRef.current, requestOwnerId, completionsRequestRef.current, requestId
      )) setActionError('Fortschritt konnte nicht geladen werden.');
    }
  }, [selectedDate]);

  useEffect(() => {
    if (!ownerUserId) return;
    const hasCachedHabits = getOwnerCache(getHabitsCacheKey(ownerUserId)) !== null;
    loadHabits({ silent: hasCachedHabits });
  }, [ownerUserId, loadHabits]);

  useEffect(() => {
    if (!ownerUserId) return;
    completionsRequestRef.current += 1;
    const cached = applyPendingCompletionMutations(
      getOwnerCache(getHabitCompletionsCacheKey(ownerUserId, selectedDate)) ?? [],
      ownerUserId,
      selectedDate
    );
    setCompletedIds(new Set(cached));
    loadCompletions();
  }, [ownerUserId, selectedDate, loadCompletions]);

  useEffect(() => {
    if (!ownerUserId) return undefined;
    const cacheKey = getHabitCompletionsCacheKey(ownerUserId, selectedDate);
    return subscribeToOwnerCache(cacheKey, (ids) => {
      if (
        mountedRef.current
        && ownerRef.current === ownerUserId
        && selectedDateRef.current === selectedDate
      ) {
        setCompletedIds(new Set(applyPendingCompletionMutations(
          ids,
          ownerUserId,
          selectedDate
        )));
      }
    });
  }, [ownerUserId, selectedDate]);

  const requireMutationOwner = useCallback(async (expectedOwnerId, habitId = null) => {
    if (!expectedOwnerId) throw new Error('Nicht eingeloggt');
    const currentUserId = await getCurrentUserId();
    if (!currentUserId || currentUserId !== expectedOwnerId || ownerRef.current !== expectedOwnerId) {
      throw new Error('Nicht eingeloggt');
    }
    if (habitId && !ownsHabit(habitsRef.current, habitId)) {
      throw new Error('Ungültige Gewohnheit.');
    }
    return expectedOwnerId;
  }, []);

  const runCompletionWorker = useCallback(async (workerKey, worker) => {
    if (worker.running) return;
    worker.running = true;

    try {
      while (worker.confirmed !== worker.desired) {
        const targetState = worker.desired;

        try {
          await requireMutationOwner(worker.ownerUserId, worker.habitId);
          await toggleCompletion(
            worker.habitId,
            worker.localDate,
            targetState,
            worker.ownerUserId
          );
          worker.confirmed = targetState;
        } catch (_error) {
          const desiredAlreadyConfirmed = worker.desired === worker.confirmed;
          clearPendingCompletionMutation(worker.ownerUserId, worker.localDate, worker.habitId);

          if (!desiredAlreadyConfirmed) {
            worker.desired = worker.confirmed;
            const completionsKey = getHabitCompletionsCacheKey(
              worker.ownerUserId,
              worker.localDate
            );
            const confirmedIds = new Set(normalizeIds(getOwnerCache(completionsKey) ?? []));
            if (worker.confirmed) confirmedIds.add(worker.habitId);
            else confirmedIds.delete(worker.habitId);
            setOwnerCache(completionsKey, Array.from(confirmedIds));

            if (
              mountedRef.current
              && ownerRef.current === worker.ownerUserId
              && selectedDateRef.current === worker.localDate
            ) {
              setCompletedIds(confirmedIds);
              setActionError('Änderung konnte nicht gespeichert werden.');
            }
          }
          return;
        }
      }

      clearPendingCompletionMutation(worker.ownerUserId, worker.localDate, worker.habitId);
    } finally {
      worker.running = false;
      if (
        worker.confirmed === worker.desired
        && completionWorkersRef.current.get(workerKey) === worker
      ) {
        completionWorkersRef.current.delete(workerKey);
      }
    }
  }, [requireMutationOwner]);

  const visibleHabits = useMemo(
    () => habits.filter(habit => habit.days.includes(selectedDay)),
    [habits, selectedDay]
  );
  const completedCount = useMemo(
    () => visibleHabits.filter(habit => completedIds.has(habit.id)).length,
    [visibleHabits, completedIds]
  );
  const total = visibleHabits.length;
  const progress = total === 0 ? 0 : completedCount / total;

  const toggle = useCallback((id) => {
    const mutationOwnerId = ownerRef.current;
    if (!mutationOwnerId || !ownsHabit(habitsRef.current, id)) {
      if (mountedRef.current) setActionError('Änderung konnte nicht gespeichert werden.');
      return;
    }
    const mutationDate = selectedDate;
    const completionsKey = getHabitCompletionsCacheKey(mutationOwnerId, mutationDate);
    const workerKey = `${mutationOwnerId}:${mutationDate}:${id}`;
    let worker = completionWorkersRef.current.get(workerKey);

    if (!worker) {
      const confirmed = normalizeIds(getOwnerCache(completionsKey) ?? []).includes(id);
      worker = {
        ownerUserId: mutationOwnerId,
        localDate: mutationDate,
        habitId: id,
        confirmed,
        desired: confirmed,
        running: false,
      };
      completionWorkersRef.current.set(workerKey, worker);
    }

    worker.desired = !worker.desired;
    completionsRequestRef.current += 1;
    setPendingCompletionMutation(mutationOwnerId, mutationDate, id, worker.desired);
    const optimistic = new Set(normalizeIds(getOwnerCache(completionsKey) ?? []));
    if (worker.desired) optimistic.add(id);
    else optimistic.delete(id);
    setOwnerCache(completionsKey, Array.from(optimistic));
    if (ownerRef.current === mutationOwnerId && selectedDateRef.current === mutationDate) {
      setCompletedIds(optimistic);
    }
    void runCompletionWorker(workerKey, worker);
  }, [runCompletionWorker, selectedDate]);

  const remove = useCallback(async (id) => {
    let mutationOwnerId;
    try {
      mutationOwnerId = ownerRef.current;
      await requireMutationOwner(mutationOwnerId, id);
    } catch (_error) {
      if (mountedRef.current) setActionError('Gewohnheit konnte nicht gelöscht werden.');
      return;
    }
    const mutationDate = selectedDateRef.current;
    const habitsKey = getHabitsCacheKey(mutationOwnerId);
    const completionsKey = getHabitCompletionsCacheKey(mutationOwnerId, mutationDate);
    const actionKey = `${mutationOwnerId}:delete:${id}`;
    if (pendingActionsRef.current.has(actionKey)) return;
    pendingActionsRef.current.add(actionKey);
    const previousHabits = normalizeHabits(getOwnerCache(habitsKey) ?? habitsRef.current);
    const previousCompletions = normalizeIds(getOwnerCache(completionsKey) ?? []);
    const nextHabits = previousHabits.filter(habit => habit.id !== id);
    const nextCompletions = previousCompletions.filter(habitId => habitId !== id);
    setOwnerCache(habitsKey, nextHabits);
    setOwnerCache(completionsKey, nextCompletions);
    if (ownerRef.current === mutationOwnerId) {
      habitsRef.current = nextHabits;
      setHabits(nextHabits);
      if (selectedDateRef.current === mutationDate) setCompletedIds(new Set(nextCompletions));
    }
    try {
      await deleteHabit(id, mutationOwnerId);
    } catch (_error) {
      setOwnerCache(habitsKey, previousHabits);
      setOwnerCache(completionsKey, previousCompletions);
      if (mountedRef.current && ownerRef.current === mutationOwnerId) {
        habitsRef.current = previousHabits;
        setHabits(previousHabits);
        if (selectedDateRef.current === mutationDate) setCompletedIds(new Set(previousCompletions));
        setActionError('Gewohnheit konnte nicht gelöscht werden.');
      }
    } finally {
      pendingActionsRef.current.delete(actionKey);
    }
  }, [requireMutationOwner]);

  const add = useCallback(async (name, days, linkedTool = null) => {
    const safeName = typeof name === 'string' ? name.trim() : '';
    const safeDays = normalizeDays(days);
    if (!safeName || safeDays.length === 0) return null;
    let mutationOwnerId;
    try {
      mutationOwnerId = ownerRef.current;
      await requireMutationOwner(mutationOwnerId);
    } catch (_error) {
      if (mountedRef.current) setActionError('Gewohnheit konnte nicht gespeichert werden.');
      return null;
    }
    const safeLinkedTool = normalizeLinkedTool(linkedTool);
    const actionKey = `${mutationOwnerId}:add:${safeName}:${safeDays.join(',')}:${safeLinkedTool?.id ?? 'none'}`;
    if (pendingActionsRef.current.has(actionKey)) return null;
    pendingActionsRef.current.add(actionKey);
    try {
      const newHabit = normalizeHabit(await addHabit(
        safeName, safeDays, safeLinkedTool, mutationOwnerId
      ));
      if (!newHabit || !mountedRef.current || ownerRef.current !== mutationOwnerId) return newHabit;
      const nextHabits = [...habitsRef.current, newHabit];
      habitsRef.current = nextHabits;
      setHabits(nextHabits);
      setOwnerCache(getHabitsCacheKey(mutationOwnerId), nextHabits);
      return newHabit;
    } finally {
      pendingActionsRef.current.delete(actionKey);
    }
  }, [requireMutationOwner]);

  const update = useCallback(async (id, name, days, linkedTool = null) => {
    const safeName = typeof name === 'string' ? name.trim() : '';
    const safeDays = normalizeDays(days);
    if (!id || !safeName || safeDays.length === 0) return null;
    let mutationOwnerId;
    try {
      mutationOwnerId = ownerRef.current;
      await requireMutationOwner(mutationOwnerId, id);
    } catch (_error) {
      if (mountedRef.current) setActionError('Gewohnheit konnte nicht aktualisiert werden.');
      return null;
    }
    const safeLinkedTool = normalizeLinkedTool(linkedTool);
    const actionKey = `${mutationOwnerId}:update:${id}`;
    if (pendingActionsRef.current.has(actionKey)) return null;
    pendingActionsRef.current.add(actionKey);
    try {
      const updatedHabit = normalizeHabit(await updateHabit(
        id, safeName, safeDays, safeLinkedTool, mutationOwnerId
      ));
      if (!updatedHabit || !mountedRef.current || ownerRef.current !== mutationOwnerId) return updatedHabit;
      const nextHabits = habitsRef.current.map(habit => habit.id === id ? updatedHabit : habit);
      habitsRef.current = nextHabits;
      setHabits(nextHabits);
      setOwnerCache(getHabitsCacheKey(mutationOwnerId), nextHabits);
      return updatedHabit;
    } finally {
      pendingActionsRef.current.delete(actionKey);
    }
  }, [requireMutationOwner]);

  return {
    habits,
    visibleHabits,
    completedIds,
    loading,
    loadError,
    actionError,
    completedCount,
    total,
    progress,
    setActionError,
    loadHabits,
    loadCompletions,
    toggle,
    remove,
    add,
    update,
  };
}
