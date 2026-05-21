import { COLORS } from '../constants/colors';
import { TOOL_IMAGES } from '../constants/toolAssets';

export const tools = [
  {
    id: 'todo',
    title: 'To-Do',
    description: 'Setze dir klare Aufgaben.',
    image: TOOL_IMAGES.todo,
    route: '/tools/todo',
  },
  {
    id: 'training-plan',
    title: 'Trainingsplan',
    description: 'Trainiere mit Struktur',
    image: TOOL_IMAGES.trainingsplan,
    route: '/tools/training-plan',
  },
  {
    id: 'goals',
    title: 'Ziele',
    description: 'Definiere deine Zukunft',
    image: TOOL_IMAGES.goals,
    route: '/tools/goals',
  },
  {
    id: 'habits',
    title: 'Gewohnheiten',
    description: 'Baue Streaks auf.',
    image: TOOL_IMAGES.habits,
    route: '/tools/habits',
  },
  {
    id: 'deep-work',
    title: 'Deep Work',
    description: 'Arbeite im Fokus',
    image: TOOL_IMAGES.deepWork,
    route: '/tools/deep-work',
  },
  {
    id: 'daily-planner',
    title: 'Tagesplaner',
    description: 'Strukturiere deinen Tag.',
    image: TOOL_IMAGES.planner,
    route: '/tools/daily-planner',
  },
  {
    id: 'journal',
    title: 'Journal',
    description: 'Reflektiere deinen Tag.',
    type: 'Ionicons',
    name: 'book-outline',
    route: '/tools/journal',
  },
  {
    id: 'coming-soon',
    title: 'In Bearbeitung',
    description: '',
    type: 'Feather',
    name: 'tool',
    color: COLORS.textSecondary,
    disabled: true,
  },
];