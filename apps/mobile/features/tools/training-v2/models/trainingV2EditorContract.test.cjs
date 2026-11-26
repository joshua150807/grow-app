const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const {
  buildCreatePlanInput,
  buildUpdatePlanInput,
  createEmptyEditorState,
  trainingV2EditorReducer,
} = require('../testing/loadModule.cjs').loadModule(__dirname, './trainingV2EditorModel.js');

const repositoryRoot = path.resolve(__dirname, '../../../../../..');

// This test validates payloads built by the mobile editor model against the *real*
// Zod schemas in packages/shared/src (never packages/shared/dist, which can drift
// out of date), matching the runtime-proof pattern used for the read-only C2 module.
function safeParseWithRealSchema(schemaExportName, payload) {
  const script = `
    import { ${schemaExportName} } from './packages/shared/src/index.ts';
    const payload = ${JSON.stringify(payload)};
    const result = ${schemaExportName}.safeParse(payload);
    process.stdout.write(JSON.stringify({
      success: result.success,
      issuePaths: result.success ? [] : result.error.issues.map((issue) => issue.path.join('.')),
    }));
  `;
  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', '--input-type=module', '-e', script],
    { cwd: repositoryRoot, encoding: 'utf8' },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

function buildValidCreateState() {
  let state = createEmptyEditorState();
  state = trainingV2EditorReducer(state, { type: 'SET_NAME', name: 'Ganzkörper Plan' });
  state = trainingV2EditorReducer(state, { type: 'SET_WEEKLY_GOAL', weeklyGoal: '3' });
  const unitKey = state.units[0].logicalUnitKey;
  state = trainingV2EditorReducer(state, { type: 'SET_UNIT_NAME', logicalUnitKey: unitKey, name: 'Tag 1' });
  state = trainingV2EditorReducer(state, { type: 'ADD_EXERCISE', logicalUnitKey: unitKey });
  const exerciseKey = state.units[0].exercises[0].logicalTargetExerciseKey;
  state = trainingV2EditorReducer(state, {
    type: 'SET_EXERCISE_SELECTION',
    logicalUnitKey: unitKey,
    logicalTargetExerciseKey: exerciseKey,
    exerciseId: '00000000-0000-4000-8000-000000000001',
    exerciseName: 'Kniebeuge',
  });
  return state;
}

test('a fully populated create payload satisfies the real createTrainingPlanInputSchema', () => {
  const state = buildValidCreateState();
  const payload = buildCreatePlanInput(state);
  const outcome = safeParseWithRealSchema('createTrainingPlanInputSchema', payload);
  assert.equal(outcome.success, true, JSON.stringify(outcome.issuePaths));
});

test('a strength unit missing an exercise fails the real createTrainingPlanInputSchema', () => {
  const state = createEmptyEditorState();
  const payload = buildCreatePlanInput(state);
  const outcome = safeParseWithRealSchema('createTrainingPlanInputSchema', payload);
  assert.equal(outcome.success, false);
  assert.ok(outcome.issuePaths.some((issuePath) => issuePath.includes('exercises')));
});

test('an edit payload with expectedVersion satisfies the real updateTrainingPlanInputSchema', () => {
  const state = buildValidCreateState();
  const payload = buildUpdatePlanInput(state, 2);
  const outcome = safeParseWithRealSchema('updateTrainingPlanInputSchema', payload);
  assert.equal(outcome.success, true, JSON.stringify(outcome.issuePaths));
});

test('an edit payload can never smuggle weeklyGoal past the strict real updateTrainingPlanInputSchema', () => {
  const state = buildValidCreateState();
  const payload = { ...buildUpdatePlanInput(state, 2), weeklyGoal: 5 };
  const outcome = safeParseWithRealSchema('updateTrainingPlanInputSchema', payload);
  assert.equal(outcome.success, false);
});

test('a run unit carrying exercises fails the real createTrainingPlanInputSchema', () => {
  const state = buildValidCreateState();
  const validPayload = buildCreatePlanInput(state);
  // The reducer itself would strip exercises when switching a unit to run/rest
  // (covered in trainingV2EditorModel.test.cjs); here we mutate the already-built
  // payload directly to prove the server-authoritative schema rejects this shape
  // too, independent of the client-side guard rail.
  const payload = {
    ...validPayload,
    units: [{ ...validPayload.units[0], unitType: 'run' }],
  };
  const outcome = safeParseWithRealSchema('createTrainingPlanInputSchema', payload);
  assert.equal(outcome.success, false);
});
