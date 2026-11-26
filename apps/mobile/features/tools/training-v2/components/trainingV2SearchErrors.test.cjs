const assert = require('node:assert/strict');
const test = require('node:test');
const { createHookHarness } = require('../testing/createHookHarness.cjs');
const { loadJsxModule } = require('../testing/loadJsxModule.cjs');
const { loadModule } = require('../testing/loadModule.cjs');
function nodes(node) {
  if (Array.isArray(node)) return node.flatMap(nodes);
  return node && typeof node === 'object' ? [node, ...nodes(node.props?.children)] : [];
}
test('B15: failed catalog confirmation retains typed text and never creates a private exercise', async (context) => {
  const actions = [];
  const harness = createHookHarness((react) => {
    const { TrainingV2InlineExercisePicker } = loadJsxModule(__dirname, './TrainingV2InlineExercisePicker.jsx', {
      react, 'react-native': { TextInput: 'TextInput' },
      '../styles/trainingV2Styles': { styles: {} },
      '../utils/trainingV2ExerciseName': { cleanExerciseName: (value) => value.trim() },
      '../utils/trainingV2MuscleGroups': { UI_MUSCLE_GROUPS: [], uiMuscleGroupLabel: () => 'Other' },
      '../hooks/useTrainingV2ExercisePicker': { useTrainingV2ExercisePicker: () => ({ results: [], reset() {}, search: async () => ({ results: [], exactMatch: null, error: new Error('offline') }) }) },
    });
    return () => TrainingV2InlineExercisePicker({ dispatch: (action) => actions.push(action), exercise: { exerciseName: '' } });
  });
  context.after(() => harness.unmount());
  harness.render();
  nodes(harness.result).find((node) => node.props?.onPress).props.onPress();
  harness.render();
  nodes(harness.result).find((node) => node.type === 'TextInput').props.onChangeText('Known exercise');
  harness.render();
  await nodes(harness.result).find((node) => node.type === 'TextInput').props.onSubmitEditing();
  harness.render();
  assert.equal(actions.length, 0);
  assert.equal(nodes(harness.result).find((node) => node.type === 'TextInput').props.value, 'Known exercise');
});
test('B16: every supported unit type has a visible detail label', () => {
  const model = loadModule(__dirname, '../models/trainingV2ViewModel.js');
  const plan = { revision: { units: ['strength', 'run', 'rest', 'mobility', 'stretching'].map((unitType) => ({ unitType, exercises: [] })) } };
  assert.deepEqual(model.mapTrainingV2PlanDetail(plan, {}).units.map((unit) => unit.unitTypeLabel), ['Kraft', 'Laufen', 'Erholung', 'Mobility', 'Dehnen']);
});
