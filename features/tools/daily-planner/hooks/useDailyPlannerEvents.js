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

export function useDailyPlannerEvents(currentYear, currentMonth, selectedDate) {
  const [monthEventDates, setMonthEventDates] = useState(new Set());
  const [events, setEvents] = useState([]);
  const [dayLoading, setDayLoading] = useState(false);
  const [dayError, setDayError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadMonthEvents() {
      try {
        const data = await getEventsForMonth(currentYear, currentMonth + 1);

        if (!cancelled) {
          setMonthEventDates(new Set(data.map(event => event.date)));
        }
      } catch {
        // Dots may fail silently.
      }
    }

    loadMonthEvents();

    return () => {
      cancelled = true;
    };
  }, [currentYear, currentMonth]);

  const loadDayEvents = useCallback(async (dateStr) => {
    setDayLoading(true);
    setDayError(null);

    try {
      const data = await getEventsForDate(dateStr);
      setEvents(data);
    } catch {
      setDayError('Termine konnten nicht geladen werden.');
    } finally {
      setDayLoading(false);
    }
  }, []);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

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

      setEvents(prev =>
        prev
          .map(event => event.id === editingEventId ? updatedEvent : event)
          .sort((a, b) => a.start_time.localeCompare(b.start_time))
      );

      return updatedEvent;
    }

    const newEvent = await addEvent({
      date: selectedDate,
      startTime,
      endTime,
      title: modalTitle.trim(),
      color: modalColor,
    });

    setEvents(prev =>
      [...prev, newEvent].sort((a, b) => a.start_time.localeCompare(b.start_time))
    );

    setMonthEventDates(prev => new Set([...prev, selectedDate]));

    return newEvent;
  }, [selectedDate]);

  const removeEvent = useCallback(async (id) => {
    setEvents(prev => prev.filter(event => event.id !== id));

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