import { COLORS } from '../constants/colors';

const trainingsplanIcon = require('../assets/tool-icons/trainingsplan.png')
const goalsIcon = require('../assets/tool-icons/goals-icon.png')
const habitsIcon = require('../assets/tool-icons/habits-icon.png')
const plannerIcon = require('../assets/tool-icons/plannerIcon.png')
const todoIcon = require('../assets/tool-icons/todoIcon.png')
const deepworkIcon = require('../assets/tool-icons/deepworkIcon.png')

export const tools = [
  {
    id: 'todo',
    title: 'To-Do',
    description: 'Setze dir klare Aufgaben.',
    image: todoIcon,
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
    image: habitsIcon,
    route: '/tools/habits',
  },
  {
    id: 'deep-work',
    title: 'Deep Work',
    description: 'Arbeite im Fokus',
    image: deepworkIcon,
    route: '/tools/deep-work',
  },
  {
    id: 'daily-planner',
    title: 'Tagesplaner',
    description: 'Strukturiere deinen Tag.',
    image: plannerIcon,
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