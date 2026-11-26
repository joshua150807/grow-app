const assert = require('node:assert/strict');
const test = require('node:test');

const { loadModule } = require('../testing/loadModule.cjs');

function loadNameUtil() {
  return loadModule(__dirname, './trainingV2ExerciseName.js');
}

test('cleanExerciseName trims and collapses internal whitespace runs without changing case', () => {
  const { cleanExerciseName } = loadNameUtil();
  assert.equal(cleanExerciseName('  Kabel   Rudern  '), 'Kabel Rudern');
  assert.equal(cleanExerciseName('Bankdrücken'), 'Bankdrücken');
  assert.equal(cleanExerciseName(''), '');
  assert.equal(cleanExerciseName(null), '');
  assert.equal(cleanExerciseName(undefined), '');
});

test('normalizeExerciseName additionally case-folds for equality comparisons', () => {
  const { normalizeExerciseName } = loadNameUtil();
  assert.equal(normalizeExerciseName('  Kabel   Rudern  '), 'kabel rudern');
  assert.equal(normalizeExerciseName('KABEL RUDERN'), 'kabel rudern');
  assert.equal(
    normalizeExerciseName('Kabel Rudern'),
    normalizeExerciseName('  kabel   rudern '),
  );
});
