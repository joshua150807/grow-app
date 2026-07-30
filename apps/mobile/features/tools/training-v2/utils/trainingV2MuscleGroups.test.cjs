const assert = require('node:assert/strict');
const test = require('node:test');

const { loadModule } = require('../testing/loadModule.cjs');

function loadMuscleGroups() {
  return loadModule(__dirname, './trainingV2MuscleGroups.js');
}

test('exposes exactly the nine required UI muscle groups with their German labels', () => {
  const { UI_MUSCLE_GROUPS } = loadMuscleGroups();
  assert.deepEqual(UI_MUSCLE_GROUPS, [
    { value: 'chest', label: 'Brust' },
    { value: 'back', label: 'Rücken' },
    { value: 'legs', label: 'Beine' },
    { value: 'shoulders', label: 'Schulter' },
    { value: 'biceps', label: 'Bizeps' },
    { value: 'triceps', label: 'Trizeps' },
    { value: 'abs', label: 'Bauch' },
    { value: 'forearms', label: 'Unterarme' },
    { value: 'other', label: 'Sonstiges' },
  ]);
});

test('uiMuscleGroupLabel returns the German label for every UI group and falls back to Sonstiges', () => {
  const { uiMuscleGroupLabel } = loadMuscleGroups();
  assert.equal(uiMuscleGroupLabel('chest'), 'Brust');
  assert.equal(uiMuscleGroupLabel('back'), 'Rücken');
  assert.equal(uiMuscleGroupLabel('other'), 'Sonstiges');
  assert.equal(uiMuscleGroupLabel('unknown_value'), 'Sonstiges');
  assert.equal(uiMuscleGroupLabel(null), 'Sonstiges');
});

test('resolveUiMuscleGroup passes an already-resolved UI group through unchanged', () => {
  const { resolveUiMuscleGroup } = loadMuscleGroups();
  for (const value of ['chest', 'back', 'legs', 'shoulders', 'biceps', 'triceps', 'abs', 'forearms', 'other']) {
    assert.equal(resolveUiMuscleGroup(value), value);
  }
});

test('resolveUiMuscleGroup maps every fine system muscle to exactly one of the nine groups', () => {
  const { resolveUiMuscleGroup } = loadMuscleGroups();
  assert.deepEqual(
    {
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
    },
    {
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
    },
  );
});

test('resolveUiMuscleGroup falls back to Sonstiges for null, empty or unrecognized values instead of guessing', () => {
  const { resolveUiMuscleGroup } = loadMuscleGroups();
  assert.equal(resolveUiMuscleGroup(null), 'other');
  assert.equal(resolveUiMuscleGroup(undefined), 'other');
  assert.equal(resolveUiMuscleGroup(''), 'other');
  assert.equal(resolveUiMuscleGroup('some_unmapped_value'), 'other');
});
