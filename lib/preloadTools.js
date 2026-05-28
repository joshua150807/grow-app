import { preloadStartupImageAssets } from '../constants/toolAssets';
import { loadProfileData } from '../features/profile/services/profiles';
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
    console.log(`[Preload] ${label} failed:`, error);
  }
}

export function preloadAppAssetsInBackground() {
  preloadSafely('assets', preloadStartupImageAssets);
}

export function preloadProfileInBackground(userId, onLoaded) {
  if (!userId) return;

  preloadSafely('profile', async () => {
    const profile = await loadProfileData(userId);
    if (typeof onLoaded === 'function') {
      onLoaded(profile);
    }
  });
}

export function preloadToolsInBackground(userId) {
  if (!userId) return;

  const date = todayIsoDate();
  const { year, monthIndex, monthNumber } = currentPlannerMonth();

  setTimeout(() => {
    const tasks = [
      preloadSafely('todos', async () => {
        const todos = await getTodos();
        setPreloadedToolData('todos', todos);
      }),

      ...[0, 1, 2].map((categoryIndex) =>
        preloadSafely(`goals:${categoryIndex}`, async () => {
          const goals = await getGoals(categoryIndex);
          setPreloadedToolData(`goals:${categoryIndex}`, goals);
        })
      ),

      preloadSafely('habits', async () => {
        const habits = await getHabits();
        setPreloadedToolData('habits', habits);
      }),

      preloadSafely(`habitCompletions:${date}`, async () => {
        const completedIds = await getCompletionsForDate(date);
        setPreloadedToolData(`habitCompletions:${date}`, completedIds);
      }),

      preloadSafely(`plannerMonth:${year}-${monthIndex}`, async () => {
        const events = await getEventsForMonth(year, monthNumber);
        setPreloadedToolData(`plannerMonth:${year}-${monthIndex}`, events);
      }),

      preloadSafely(`plannerDay:${date}`, async () => {
        const events = await getEventsForDate(date);
        setPreloadedToolData(`plannerDay:${date}`, events);
      }),

      preloadSafely('notes', async () => {
        const notes = await getNotes();
        setPreloadedToolData('notes', notes);
      }),

      preloadSafely('journal', async () => {
        const entries = await getJournalEntries();
        setPreloadedToolData('journal', entries);
      }),

      preloadSafely('affirmations', async () => {
        const affirmations = await getAffirmations();
        setPreloadedToolData('affirmations', affirmations);
      }),

      preloadSafely('trainingPlan', async () => {
        const plan = await fetchTrainingPlan();
        setPreloadedToolData('trainingPlan', plan);
      }),

      preloadSafely('trainingSessions', async () => {
        const sessions = await fetchLatestTrainingSessions();
        setPreloadedToolData('trainingSessions', sessions);
      }),
    ];

    Promise.allSettled(tasks);
  }, 350);
}