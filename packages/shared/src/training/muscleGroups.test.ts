import { describe, expect, it } from 'vitest';
import { resolveUiMuscleGroup } from '../index.js';

describe('resolveUiMuscleGroup (shared 20-to-9 muscle-group mapping)', () => {
  it('passes an already-resolved UI group through unchanged', () => {
    for (const value of ['chest', 'back', 'legs', 'shoulders', 'biceps', 'triceps', 'abs', 'forearms', 'other']) {
      expect(resolveUiMuscleGroup(value)).toBe(value);
    }
  });

  it('maps every fine system muscle to exactly one of the nine groups', () => {
    expect({
      chest: resolveUiMuscleGroup('chest'),
      lats: resolveUiMuscleGroup('lats'),
      upper_back: resolveUiMuscleGroup('upper_back'),
      lower_back: resolveUiMuscleGroup('lower_back'),
      quadriceps: resolveUiMuscleGroup('quadriceps'),
      hamstrings: resolveUiMuscleGroup('hamstrings'),
      glutes: resolveUiMuscleGroup('glutes'),
      calves: resolveUiMuscleGroup('calves'),
      adductors: resolveUiMuscleGroup('adductors'),
      abductors: resolveUiMuscleGroup('abductors'),
      front_delts: resolveUiMuscleGroup('front_delts'),
      side_delts: resolveUiMuscleGroup('side_delts'),
      rear_delts: resolveUiMuscleGroup('rear_delts'),
      traps: resolveUiMuscleGroup('traps'),
      biceps: resolveUiMuscleGroup('biceps'),
      triceps: resolveUiMuscleGroup('triceps'),
      abs: resolveUiMuscleGroup('abs'),
      obliques: resolveUiMuscleGroup('obliques'),
      forearms: resolveUiMuscleGroup('forearms'),
      hip_flexors: resolveUiMuscleGroup('hip_flexors'),
    }).toEqual({
      chest: 'chest',
      lats: 'back',
      upper_back: 'back',
      lower_back: 'back',
      quadriceps: 'legs',
      hamstrings: 'legs',
      glutes: 'legs',
      calves: 'legs',
      adductors: 'legs',
      abductors: 'legs',
      front_delts: 'shoulders',
      side_delts: 'shoulders',
      rear_delts: 'shoulders',
      traps: 'shoulders',
      biceps: 'biceps',
      triceps: 'triceps',
      abs: 'abs',
      obliques: 'abs',
      forearms: 'forearms',
      hip_flexors: 'other',
    });
  });

  it('falls back to Sonstiges (other) for null, undefined or unrecognized values instead of guessing', () => {
    expect(resolveUiMuscleGroup(null)).toBe('other');
    expect(resolveUiMuscleGroup(undefined)).toBe('other');
    expect(resolveUiMuscleGroup('some_unmapped_value')).toBe('other');
  });
});
