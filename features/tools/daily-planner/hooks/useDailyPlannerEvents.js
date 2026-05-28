import { useCallback, useEffect, useState } from 'react';

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

export function useDailyPlannerEvents(currentYear, currentMonth, selectedDate) {
  const monthCacheKey = `plannerMonth:${currentYear}-${currentMonth}`;
  const dayCacheKey = selectedDate ? `plannerDay:${selectedDate}` : null;
  const preloadedMonthEvents = getPreloadedToolData(monthCacheKey);
  const preloadedDayEvents = dayCacheKey ? getPreloadedToolData(dayCacheKey) : null;

  const [monthEventDates, setMonthEventDates] = useState(() => new Set((preloadedMonthEvents ?? []).map(event => event.date)));
  const [events, setEvents] = useState(() => preloadedDayEvents ?? []);
  const [dayLoading, setDayLoading] = useState(false);
  const [dayError, setDayError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadMonthEvents() {
      try {
        const data = await getEventsForMonth(currentYear, currentMonth + 1);

        if (!cancelled) {
          setMonthEventDates(new Set(data.map(event => event.date)));
          setPreloadedToolData(monthCacheKey, data);
        }
      } catch {
        // Dots may fail silently.
      }
    }

    loadMonthEvents();

    return () => {
      cancelled = true;
    };
  }, [currentYear, currentMonth, monthCacheKey]);

  const loadDayEvents = useCallback(async (dateStr, { silent = false } = {}) => {
    if (!silent) {
      setDayLoading(true);
    }
    setDayError(null);

    const cacheKey = `plannerDay:${dateStr}`;

    try {
      const data = await getEventsForDate(dateStr);
      setEvents(data);
      setPreloadedToolData(cacheKey, data);
    } catch {
      setDayError('Termine konnten nicht geladen werden.');
    } finally {
      if (!silent) {
        setDayLoading(false);
      }
    }
  }, []);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  useEffect(() => {
    if (!selectedDate || !dayCacheKey) return;

    const cached = getPreloadedToolData(dayCacheKey);
    if (cached) {
      setEvents(cached);
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
    if (!modalTitle.trim()) return null;
    if (modalStartMinutes === null || modalStartMinutes === undefined) return null;
    if (!selectedDate) return null;

    const safeStartMinutes = Math.max(0, Math.min(modalStartMinutes, DAY_MINUTES - 1));
    const safeDuration = Math.max(1, Math.min(modalDuration, DAY_MINUTES - 1));
    const safeEndMinutes = Math.min(safeStartMinutes + safeDuration, DAY_MINUTES - 1);

    const startTime = minutesToTime(safeStartMinutes);
    const endTime = minutesToTime(safeEndMinutes);

    if (editingEventId) {
      const updatedEvent = await updateEvent({
        id: editingEventId,
        startTime,
        endTime,
        title: modalTitle.trim(),
        color: modalColor,
      });

      setEvents(prev => {
        const nextEvents = prev
          .map(event => event.id === editingEventId ? updatedEvent : event)
          .sort((a, b) => a.start_time.localeCompare(b.start_time));
        setPreloadedToolData(`plannerDay:${selectedDate}`, nextEvents);
        return nextEvents;
      });

      return updatedEvent;
    }

    const newEvent = await addEvent({
      date: selectedDate,
      startTime,
      endTime,
      title: modalTitle.trim(),
      color: modalColor,
    });

    setEvents(prev => {
      const nextEvents = [...prev, newEvent].sort((a, b) => a.start_time.localeCompare(b.start_time));
      setPreloadedToolData(`plannerDay:${selectedDate}`, nextEvents);
      return nextEvents;
    });

    setMonthEventDates(prev => new Set([...prev, selectedDate]));

    return newEvent;
  }, [selectedDate]);

  const removeEvent = useCallback(async (id) => {
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
    }
  }, [selectedDate, loadDayEvents]);

  return {
    monthEventDates,
    events,
    dayLoading,
    dayError,
    loadDayEvents,
    clearEvents,
    saveEvent,
    removeEvent,
  };
}