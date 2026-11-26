import { resolveUiMuscleGroup } from '@grow/shared';

export { resolveUiMuscleGroup };

// The nine muscle groups shown in the UI (private-exercise creation form, search result
// labels). Stable internal values mirror uiMuscleGroupSchema in @grow/shared.
export const UI_MUSCLE_GROUPS = [
  { value: 'chest', label: 'Brust' },
  { value: 'back', label: 'Rücken' },
  { value: 'legs', label: 'Beine' },
  { value: 'shoulders', label: 'Schulter' },
  { value: 'biceps', label: 'Bizeps' },
  { value: 'triceps', label: 'Trizeps' },
  { value: 'abs', label: 'Bauch' },
  { value: 'forearms', label: 'Unterarme' },
  { value: 'other', label: 'Sonstiges' },
];

const UI_MUSCLE_GROUP_LABELS = Object.fromEntries(
  UI_MUSCLE_GROUPS.map((group) => [group.value, group.label]),
);

export function uiMuscleGroupLabel(value) {
  return UI_MUSCLE_GROUP_LABELS[value] ?? UI_MUSCLE_GROUP_LABELS.other;
}
