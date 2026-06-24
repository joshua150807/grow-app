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
  recommendations: require('../assets/tool-icons/recommendationIcon.webp'),
  inProgress: require('../assets/tool-icons/in-progress-icon.webp')
};

export const MENTOR_BG = require('../assets/tool-icons/mentor-bg.webp');
export const GROW_COIN = require('../assets/images/grow_coin.webp');
export const GROW_POINTS_ICON = require('../assets/images/grow_points_leaf.webp');
export const GROW_AVATAR = require('../assets/images/grow_avatar.webp');
export const TRACKER_BG = require('../assets/tool-icons/active-tracker-bg.webp');
export const TODO_PAGE_BG = require('../assets/tool-icons/backgrounds/todo-page-bg.webp');
export const TRAINING_PAGE_BG = require('../assets/tool-icons/backgrounds/training-page-bg.webp');
export const DEEPWORK_PAGE_BG = require('../assets/tool-icons/backgrounds/deepwork-page-bg.webp');
export const GOALS_PAGE_BG = require('../assets/tool-icons/backgrounds/goals-page-bg.webp');
export const HABITS_PAGE_BG = require('../assets/tool-icons/backgrounds/habits-page-bg.webp')
export const DAILY_PLANNER_PAGE_BG = require('../assets/tool-icons/backgrounds/daily-planner-page-bg.webp');
export const AFFIRMATIONS_PAGE_BG = require('../assets/tool-icons/backgrounds/affirmations-page-bg.webp');
export const RECOMMENDATIONS_PAGE_BG = require('../assets/tool-icons/backgrounds/recommendations-page-bg.webp');
export const NOTES_PAGE_BG = require('../assets/tool-icons/backgrounds/notes-page-bg.webp');
export const JOURNAL_PAGE_BG = require('../assets/tool-icons/backgrounds/journal-page-bg.webp')

export const TOOL_OVERVIEW_IMAGE_ASSETS = [
  ...Object.values(TOOL_IMAGES),
  MENTOR_BG,
  TRACKER_BG,
  GROW_COIN,
  GROW_POINTS_ICON,
  GROW_AVATAR,
];


export const FEEDBACK_IMAGE_ASSETS = [
  require('../assets/feedback/feedback-hero.webp'),
  require('../assets/feedback/feedback-card-idea.webp'),
  require('../assets/feedback/feedback-card-bug.webp'),
  require('../assets/feedback/feedback-card-praise.webp'),
  require('../assets/feedback/feedback-large-field.webp'),
  require('../assets/feedback/feedback-importance-circle-1.webp'),
  require('../assets/feedback/feedback-importance-circle-2.webp'),
  require('../assets/feedback/feedback-importance-circle-3.webp'),
  require('../assets/feedback/feedback-importance-circle-4.webp'),
  require('../assets/feedback/feedback-upload-field.webp'),
  require('../assets/feedback/feedback-info-opinion.webp'),
  require('../assets/feedback/feedback-info-growth.webp'),
  require('../assets/feedback/feedback-info-points.webp'),
  require('../assets/feedback/feedback-send-button.webp'),
];

export const TOOL_PAGE_BACKGROUND_ASSETS = [
  TODO_PAGE_BG,
  TRAINING_PAGE_BG,
  DEEPWORK_PAGE_BG,
  GOALS_PAGE_BG,
  HABITS_PAGE_BG,
  DAILY_PLANNER_PAGE_BG,
  AFFIRMATIONS_PAGE_BG,
  RECOMMENDATIONS_PAGE_BG,
  NOTES_PAGE_BG,
  JOURNAL_PAGE_BG,
];  

let toolOverviewImagesPreloaded = false;
let toolOverviewImagesPromise = null;
let toolPageBackgroundsPreloaded = false;
let feedbackImagesPreloaded = false;

export async function preloadToolOverviewImageAssets() {
  if (toolOverviewImagesPreloaded) return;

  if (!toolOverviewImagesPromise) {
    toolOverviewImagesPromise = Asset.loadAsync(TOOL_OVERVIEW_IMAGE_ASSETS)
      .then(() => {
        toolOverviewImagesPreloaded = true;
      })
      .catch((err) => {
        toolOverviewImagesPromise = null;
        throw err;
      });
  }

  await toolOverviewImagesPromise;
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


export async function preloadFeedbackImageAssets() {
  if (feedbackImagesPreloaded) return;

  feedbackImagesPreloaded = true;

  try {
    await Asset.loadAsync(FEEDBACK_IMAGE_ASSETS);
  } catch (err) {
    feedbackImagesPreloaded = false;
    throw err;
  }
}