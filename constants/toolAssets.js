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

export const STARTUP_IMAGE_ASSETS = [
  ...Object.values(TOOL_IMAGES),
  MENTOR_BG,
];

export async function preloadStartupImageAssets() {
  await Asset.loadAsync(STARTUP_IMAGE_ASSETS);
}