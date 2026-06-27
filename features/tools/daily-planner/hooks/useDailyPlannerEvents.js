import { useCallback, useEffect, useRef, useState } from 'react';

import {
  getEventsForMonth,
  getEventsForDate,
  addEvent,
  updateEvent,
  deleteEvent,
} from '../services/planner'

import {
  minutesToTime,
  DAY_MINUTES,
} from '../utils/plannerUtils';
import { getPreloadedToolData, setPreloadedToolData } from '../../../../lib/preloadedTools';

function isValidDateString(date) {
  return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date);
}

function normalizeEvent(event) {
  if (!event || !event.id || !isValidDateString(event.date)) return null;

  return {
    ...event,
    title: typeof event.title === 'string' ? event.title : '',
    start_time: typeof event.start_time === 'string' ? event.start_time : '00:00',
    end_time: typeof event.end_time === 'string' ? event.end_time : '00:30',
    color: event.color || '#D4AF37',
  };
}

function normalizeEvents(events) {
  if (!Array.isArray(events)) return [];
  return events.map(normalizeEvent).filter(Boolean);
}

function sortEvents(events) {
  return normalizeEvents(events).sort((a, b) => a.start_time.localeCompare(b.start_time));
}

export function useDailyPlannerEvents(currentYear, currentMonth, selectedDate) {
  const monthCacheKey = `plannerMonth:${currentYear}-${currentMonth}`;
  const dayCacheKey = selectedDate ? `plannerDay:${selectedDate}` : null;
  const preloadedMonthEvents = getPreloadedToolData(monthCacheKey);
  const preloadedDayEvents = dayCacheKey ? getPreloadedToolData(dayCacheKey) : null;

  const [monthEventDates, setMonthEventDates] = useState(() => new Set(normalizeEvents(preloadedMonthEvents ?? []).map(event => event.date)));
  const [events, setEvents] = useState(() => sortEvents(preloadedDayEvents ?? []));
  const [dayLoading, setDayLoading] = useState(false);
  const [dayError, setDayError] = useState(null);
  const mountedRef = useRef(true);
  const monthRequestRef = useRef(0);
  const dayRequestRef = useRef(0);
  const pendingActionsRef = useRef(new Set());

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      pendingActionsRef.current.clear();
    };
  }, []);

  const loadMonthEvents = useCallback(async () => {
    const requestId = monthRequestRef.current + 1;
    monthRequestRef.current = requestId;

    try {
      const data = normalizeEvents(await getEventsForMonth(currentYear, currentMonth + 1));

      if (mountedRef.current && requestId === monthRequestRef.current) {
        setMonthEventDates(new Set(data.map(event => event.date)));
        setPreloadedToolData(monthCacheKey, data);
      }
    } catch {
      // Dots may fail silently.
    }
  }, [currentYear, currentMonth, monthCacheKey]);

  useEffect(() => {
    loadMonthEvents();
  }, [loadMonthEvents]);

  const loadDayEvents = useCallback(async (dateStr, { silent = false } = {}) => {
    if (!isValidDateString(dateStr)) return;

    const requestId = dayRequestRef.current + 1;
    dayRequestRef.current = requestId;

    if (mountedRef.current) {
      if (!silent) {
        setDayLoading(true);
      }
      setDayError(null);
    }

    const cacheKey = `plannerDay:${dateStr}`;

    try {
      const data = sortEvents(await getEventsForDate(dateStr));
      if (!mountedRef.current || requestId !== dayRequestRef.current) return;
      setEvents(data);
      setPreloadedToolData(cacheKey, data);
    } catch {
      if (!mountedRef.current || requestId !== dayRequestRef.current) return;
      setDayError('Termine konnten nicht geladen werden.');
    } finally {
      if (mountedRef.current && requestId === dayRequestRef.current && !silent) {
        setDayLoading(false);
      }
    }
  }, []);

  const clearEvents = useCallback(() => {
    if (!mountedRef.current) return;
    dayRequestRef.current += 1;
    setEvents([]);
    setDayError(null);
    setDayLoading(false);
  }, []);

  useEffect(() => {
    if (!selectedDate || !dayCacheKey) return;

    const cached = getPreloadedToolData(dayCacheKey);
    if (cached) {
      setEvents(sortEvents(cached));
      loadDayEvents(selectedDate, { silent: true });
    }
  }, [selectedDate, dayCacheKey, loadDayEvents]);

  const saveEvent = useCallback(async ({
    editingEventId = null,
    modalTitle,
    modalStartMinutes,
    modalDuration,
    modalColor,
  }) => {
    const safeTitle = typeof modalTitle === 'string' ? modalTitle.trim() : '';
    if (!safeTitle) return null;
    if (modalStartMinutes === null || modalStartMinutes === undefined) return null;
    if (!isValidDateString(selectedDate)) return null;

    const actionKey = editingEventId ? `update:${editingEventId}` : `add:${selectedDate}:${safeTitle}:${modalStartMinutes}`;
    if (pendingActionsRef.current.has(actionKey)) return null;
    pendingActionsRef.current.add(actionKey);

    try {
      const safeStartMinutes = Math.max(0, Math.min(Number(modalStartMinutes), DAY_MINUTES - 1));
      const safeDuration = Math.max(1, Math.min(Number(modalDuration) || 1, DAY_MINUTES - 1));
      const safeEndMinutes = Math.min(safeStartMinutes + safeDuration, DAY_MINUTES - 1);

      const startTime = minutesToTime(safeStartMinutes);
      const endTime = minutesToTime(safeEndMinutes);

      if (editingEventId) {
        const updatedEvent = normalizeEvent(await updateEvent({
          id: editingEventId,
          startTime,
          endTime,
          title: safeTitle,
          color: modalColor,
        }));

        if (!updatedEvent) return null;

        if (mountedRef.current) {
          setEvents(prev => {
            const nextEvents = sortEvents(prev.map(event => event.id === editingEventId ? updatedEvent : event));
            setPreloadedToolData(`plannerDay:${selectedDate}`, nextEvents);
            return nextEvents;
          });
        }

        return updatedEvent;
      }

      const newEvent = normalizeEvent(await addEvent({
        date: selectedDate,
        startTime,
        endTime,
        title: safeTitle,
        color: modalColor,
      }));

      if (!newEvent) return null;

      if (mountedRef.current) {
        setEvents(prev => {
          const nextEvents = sortEvents([...prev, newEvent]);
          setPreloadedToolData(`plannerDay:${selectedDate}`, nextEvents);
          return nextEvents;
        });

        setMonthEventDates(prev => new Set([...prev, selectedDate]));
      }

      return newEvent;
    } finally {
      pendingActionsRef.current.delete(actionKey);
    }
  }, [selectedDate]);

  const removeEvent = useCallback(async (id) => {
    if (!id) return;

    const actionKey = `delete:${id}`;
    if (pendingActionsRef.current.has(actionKey)) return;
    pendingActionsRef.current.add(actionKey);

    setEvents(prev => {
      const nextEvents = prev.filter(event => event.id !== id);
      if (selectedDate) {
        setPreloadedToolData(`plannerDay:${selectedDate}`, nextEvents);
      }
      return nextEvents;
    });

    try {
      await deleteEvent(id);
    } catch {
      if (selectedDate) {
        loadDayEvents(selectedDate);
      }
    } finally {
      pendingActionsRef.current.delete(actionKey);
    }
  }, [selectedDate, loadDayEvents]);

  return {
    monthEventDates,
    loadMonthEvents,
    events,
    dayLoading,
    dayError,
    loadDayEvents,
    clearEvents,
    saveEvent,
    removeEvent,
  };
}
