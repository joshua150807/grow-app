import { InteractionManager } from 'react-native';

import { supabase } from '../services/supabaseClient';
import { getTodos } from '../features/tools/todo/services/todo';
import { getGoals } from '../features/tools/goals/services/goals';
import { getHabits, getCompletionsForDate } from '../features/tools/habits/services/habits';
import { getEventsForMonth, getEventsForDate } from '../features/tools/daily-planner/services/planner';
import { getNotes } from '../features/tools/notes/services/notesService';
import { getJournalEntries } from '../features/tools/journal/services/journal';
import { getAffirmations } from '../features/tools/affirmations/services/affirmations';
import { fetchTrainingPlan } from '../features/tools/training/services/trainingService';
import { fetchLatestTrainingSessions } from '../features/tools/training/services/trainingSessionService';
import { setPreloadedToolData } from './preloadedTools';

let hasStartedToolPreload = false;

function todayIsoDate() {
  return new Date().toISOString().split('T')[0];
}

function currentPlannerMonth() {
  const now = new Date();
  return {
    year: now.getFullYear(),
    monthIndex: now.getMonth(),
    monthNumber: now.getMonth() + 1,
  };
}

async function preloadSafely(label, task) {
  try {
    await task();
  } catch (error) {
    console.log(`[FeedReadyPreload] ${label} failed:`, error);
  }
}

function scheduleBatch(delayMs, tasks) {
  setTimeout(() => {
    InteractionManager.runAfterInteractions(() => {
      Promise.allSettled(tasks.map((task) => task()));
    });
  }, delayMs);
}

export async function startToolPreloadAfterFeedReady() {
  if (hasStartedToolPreload) return;
  hasStartedToolPreload = true;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user?.id) return;

  const date = todayIsoDate();
  const { year, monthIndex, monthNumber } = currentPlannerMonth();

  // Batch 1 startet bewusst verzögert: Erst sollen die ersten Feed-Swipes komplett frei bleiben.
  scheduleBatch(1500, [
    () =>
      preloadSafely('todos', async () => {
        const todos = await getTodos();
        setPreloadedToolData('todos', todos);
      }),

    () =>
      preloadSafely('goals:0', async () => {
        const goals = await getGoals(0);
        setPreloadedToolData('goals:0', goals);
      }),

    () =>
      preloadSafely('goals:1', async () => {
        const goals = await getGoals(1);
        setPreloadedToolData('goals:1', goals);
      }),

    () =>
      preloadSafely('goals:2', async () => {
        const goals = await getGoals(2);
        setPreloadedToolData('goals:2', goals);
      }),

    () =>
      preloadSafely('habits', async () => {
        const habits = await getHabits();
        setPreloadedToolData('habits', habits);
      }),

    () =>
      preloadSafely(`habitCompletions:${date}`, async () => {
        const completedIds = await getCompletionsForDate(date);
        setPreloadedToolData(`habitCompletions:${date}`, completedIds);
      }),
  ]);

  // Batch 2: mittlere Priorität, nachdem die wichtigsten Tools vorbereitet wurden.
  scheduleBatch(4200, [
    () =>
      preloadSafely(`plannerMonth:${year}-${monthIndex}`, async () => {
        const events = await getEventsForMonth(year, monthNumber);
        setPreloadedToolData(`plannerMonth:${year}-${monthIndex}`, events);
      }),

    () =>
      preloadSafely(`plannerDay:${date}`, async () => {
        const events = await getEventsForDate(date);
        setPreloadedToolData(`plannerDay:${date}`, events);
      }),

    () =>
      preloadSafely('trainingPlan', async () => {
        const plan = await fetchTrainingPlan();
        setPreloadedToolData('trainingPlan', plan);
      }),

    () =>
      preloadSafely('trainingSessions', async () => {
        const sessions = await fetchLatestTrainingSessions();
        setPreloadedToolData('trainingSessions', sessions);
      }),
  ]);

  // Batch 3: sekundäre Tools. Die laufen später, damit Feed + Haupttools Vorrang behalten.
  scheduleBatch(7000, [
    () =>
      preloadSafely('notes', async () => {
        const notes = await getNotes();
        setPreloadedToolData('notes', notes);
      }),

    () =>
      preloadSafely('journal', async () => {
        const entries = await getJournalEntries();
        setPreloadedToolData('journal', entries);
      }),

    () =>
      preloadSafely('affirmations', async () => {
        const affirmations = await getAffirmations();
        setPreloadedToolData('affirmations', affirmations);
      }),
  ]);
}

export function resetToolPreloadForTesting() {
  hasStartedToolPreload = false;
}