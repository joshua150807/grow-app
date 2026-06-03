import { Asset } from 'expo-asset';

export const TOOL_IMAGES = {
  trainingsplan: require('../assets/tool-icons/trainingsplan.webp'),
  goals: require('../assets/tool-icons/goals-icon.webp'),
  habits: require('../assets/tool-icons/habits-icon.webp'),
  planner: require('../assets/tool-icons/plannerIcon.webp'),
  todo: require('../assets/tool-icons/todoIcon.webp'),
  deepWork: require('../assets/tool-icons/deepworkIcon.webp'),
  affirmations: require('../assets/tool-icons/affirmationIcon.webp'),
  notes: require('../assets/tool-icons/notesIcon.webp'),
  journal: require('../assets/tool-icons/journalIcon.webp'),
  recommendations: require('../assets/tool-icons/recommendationIcon.webp')
};

export const MENTOR_BG = require('../assets/tool-icons/mentor-bg.webp');
export const TRACKER_BG = require('../assets/tool-icons/active-tracker-bg.webp');
export const TODO_PAGE_BG = require('../assets/tool-icons/backgrounds/todo-page-bg.webp');
export const TRAINING_PAGE_BG = require('../assets/tool-icons/backgrounds/training-page-bg.webp');
export const DEEPWORK_PAGE_BG = require('../assets/tool-icons/backgrounds/deepwork-page-bg.webp');
export const GOALS_PAGE_BG = require('../assets/tool-icons/backgrounds/goals-page-bg.webp');
export const HABITS_PAGE_BG = require('../assets/tool-icons/backgrounds/habits-page-bg.webp')
export const DAILY_PLANNER_PAGE_BG = require('../assets/tool-icons/backgrounds/daily-planner-page-bg.webp');

export const STARTUP_IMAGE_ASSETS = [
  ...Object.values(TOOL_IMAGES),
  MENTOR_BG,
  TRACKER_BG,
];

export const TOOL_PAGE_BACKGROUND_ASSETS = [
  TODO_PAGE_BG,
  TRAINING_PAGE_BG,
  DEEPWORK_PAGE_BG,
  GOALS_PAGE_BG,
  HABITS_PAGE_BG,
  DAILY_PLANNER_PAGE_BG,
];  

let toolPageBackgroundsPreloaded = false;

export async function preloadStartupImageAssets() {
  await Asset.loadAsync(STARTUP_IMAGE_ASSETS);
}

export async function preloadToolPageBackgroundAssets() {
  if (toolPageBackgroundsPreloaded) return;

  toolPageBackgroundsPreloaded = true;

  try {
    await Asset.loadAsync(TOOL_PAGE_BACKGROUND_ASSETS);
  } catch (err) {
    toolPageBackgroundsPreloaded = false;
    throw err;
  }
}
