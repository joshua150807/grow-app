import { COLORS } from '../constants/colors';

const trainingsplanIcon = require('../assets/tool-icons/trainingsplan.png')
const goalsIcon = require('../assets/tool-icons/goals-icon.png')

export const tools = [
  {
    id: 'todo',
    title: 'To-Do',
    description: 'Setze dir klare Aufgaben.',
    type: 'Ionicons',
    name: 'checkmark-outline',
    color: COLORS.softGold,
    route: '/tools/todo',
  },
  {
    id: 'training-plan',
    title: 'Trainingsplan',
    description: 'Trainiere mit Struktur',
    image: trainingsplanIcon,
    route: '/tools/training-plan',
  },
  {
    id: 'goals',
    title: 'Ziele',
    description: 'Definiere deine Zukunft',
    image: goalsIcon,
    route: '/tools/goals',
  },
  {
    id: 'habits',
    title: 'Gewohnheiten',
    description: 'Baue Streaks auf.',
    type: 'Ionicons',
    name: 'flame-outline',
    color: COLORS.softGold,
    route: '/tools/habits',
  },
  {
    id: 'deep-work',
    title: 'Deep Work',
    description: 'Arbeite im Fokus',
    type: 'Feather',
    name: 'clock',
    color: COLORS.softGold,
    route: '/tools/deep-work',
  },
  {
    id: 'daily-planner',
    title: 'Tagesplaner',
    description: 'Strukturiere deinen Tag.',
    type: 'Ionicons',
    name: 'calendar-outline',
    color: COLORS.softGold,
    route: '/tools/daily-planner',
  },
  {
    id: 'comming-soon-1',
    title: 'In Bearbeitung',
    description: '',
    type: 'Feather',
    name: 'tool',
    color: COLORS.textSecondary,
    disabled: true,
  },
  {
    id: 'comming-soon-2',
    title: 'In Bearbeitung',
    description: '',
    type: 'Feather',
    name: 'tool',
    color: COLORS.textSecondary,
    disabled: true,
  },
  {
    id: 'comming-soon-3',
    title: 'In Bearbeitung',
    description: '',
    type: 'Feather',
    name: 'tool',
    color: COLORS.textSecondary,
    disabled: true,
  },
];