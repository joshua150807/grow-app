const assert = require('node:assert/strict');
const test = require('node:test');
const { loadJsxModule } = require('../testing/loadJsxModule.cjs');
const { loadModule } = require('../testing/loadModule.cjs');

function allNodes(node) {
  if (Array.isArray(node)) return node.flatMap(allNodes);
  return node && typeof node === 'object' ? [node, ...allNodes(node.props?.children)] : [];
}
const { TrainingV2TargetSetEditorRow } = loadJsxModule(__dirname, './TrainingV2TargetSetEditorRow.jsx', {
  'react-native': { TextInput: 'TextInput' },
  '../models/trainingV2EditorModel': { TRAINING_V2_SET_TYPE_OPTIONS: ['work'] },
  '../styles/trainingV2Styles': { styles: {} },
});
test('B03: real plan row preserves typed comma, decimal point, delete and invalid intermediate text', () => {
  let targetSet = { logicalTargetSetKey: 'set', targetWeightKg: null, targetReps: null };
  const render = () => allNodes(TrainingV2TargetSetEditorRow({ targetSet, dispatch: (action) => {
    targetSet = { ...targetSet, [action.field]: action.value };
  } })).find((node) => node.props?.accessibilityLabel === 'Gewicht in kg').props;
  for (const [text, expected] of [['1', 1], ['12', 12], ['12,', 12], ['12,5', 12.5], ['', null], ['0.', 0], ['0.25', 0.25], ['-2', null], ['abc', null], ['', null]]) {
    render().onChangeText(text);
    assert.equal(render().value, text);
    assert.equal(targetSet.targetWeightKg, expected);
  }
});

test('B03: typed valid decimals become exact numeric payloads; invalid text prevents plan save', () => {
  const model = loadModule(__dirname, '../models/trainingV2EditorModel.js');
  const state = model.createEmptyEditorState();
  state.name = 'Plan'; state.weeklyGoal = '3';
  state.units[0].name = 'A';
  state.units[0].exercises = [{ ...model.createEmptyTargetExercise(), exerciseId: 'exercise', exerciseName: 'Squat' }];
  const target = state.units[0].exercises[0].targetSets[0];
  target.weightInput = '12,5'; target.targetWeightKg = 12.5;
  const payload = model.buildCreatePlanInput(state).units[0].exercises[0].targetSets[0];
  assert.equal(payload.targetWeightKg, 12.5);
  assert.equal(Object.hasOwn(payload, 'weightInput'), false, 'UI text must not leak into the API contract');
  const { parseSessionWeightInput } = loadModule(__dirname, '../models/trainingV2SessionModel.js');
  for (const [text, expected] of [['12,5', 12.5], ['12.5', 12.5], ['12,', 12], ['', null], ['-2', null], ['abc', null], ['1e999', null]]) {
    assert.equal(parseSessionWeightInput(text), expected);
  }
  target.weightInput = '-2'; target.targetWeightKg = null;
  assert.ok(model.getEditorValidationIssues(state).some((issue) => issue.path.includes('targetWeightKg')));
});
