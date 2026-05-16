import { Asset } from 'expo-asset';

export const TOOL_IMAGES = {
  trainingsplan: require('../assets/tool-icons/trainingsplan.png'),
  goals: require('../assets/tool-icons/goals-icon.png'),
  habits: require('../assets/tool-icons/habits-icon.png'),
  planner: require('../assets/tool-icons/plannerIcon.png'),
  todo: require('../assets/tool-icons/todoIcon.png'),
  deepWork: require('../assets/tool-icons/deepworkIcon.png'),
};

export const MENTOR_BG = require('../assets/tool-icons/mentor-bg.jpg');

export const STARTUP_IMAGE_ASSETS = [
  ...Object.values(TOOL_IMAGES),
  MENTOR_BG,
];

export async function preloadStartupImageAssets() {
  await Asset.loadAsync(STARTUP_IMAGE_ASSETS);
}