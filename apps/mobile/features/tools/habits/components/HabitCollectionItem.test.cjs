const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const collectionSource = fs.readFileSync(
  path.resolve(__dirname, './HabitCollectionItem.jsx'),
  'utf8'
);
const habitSource = fs.readFileSync(
  path.resolve(__dirname, './HabitItem.jsx'),
  'utf8'
);

test('collection card uses the existing Habit card visual values', () => {
  for (const expected of [
    /minHeight: sv\(70\)/,
    /borderRadius: s\(14\)/,
    /borderWidth: 1/,
    /borderColor: COLORS\.goldBorder/,
    /backgroundColor: 'rgba\(10,10,12,0\.72\)'/,
    /backgroundColor: 'rgba\(212,175,55,0\.08\)'/,
    /borderColor: 'rgba\(212,175,55,0\.28\)'/,
    /color: COLORS\.white/,
    /color: COLORS\.textDim/,
  ]) {
    assert.match(collectionSource, expected);
    assert.match(habitSource, expected);
  }
});

test('collection check matches Habit visuals but has no toggle control', () => {
  assert.match(collectionSource, /width: s\(24\)/);
  assert.match(collectionSource, /height: s\(24\)/);
  assert.match(collectionSource, /borderRadius: s\(6\)/);
  assert.match(collectionSource, /borderWidth: 1\.5/);
  assert.match(collectionSource, /borderColor: COLORS\.goldBorder/);
  assert.doesNotMatch(collectionSource, /onToggle|toggleCompletion|onPressIn/);
  assert.equal((collectionSource.match(/<Pressable\b/g) ?? []).length, 1);
});

test('collection retains one navigation press target, chevron and progress', () => {
  assert.match(collectionSource, /onPress=\{handlePress\}/);
  assert.match(collectionSource, /onPress\?\.\(collection\)/);
  assert.match(collectionSource, /<Text style=\{styles\.chevron\}>›<\/Text>/);
  assert.match(collectionSource, /\{completedCount\}\/\{total\}/);
});

test('normal Habit interactions remain unchanged', () => {
  assert.match(habitSource, /onPressIn=\{handleToggle\}/);
  assert.match(habitSource, /style=\{StyleSheet\.absoluteFill\}[\s\S]*?onPress=\{handleToggle\}/);
  assert.match(habitSource, /onEdit\?\.\(habit\)/);
  assert.match(habitSource, /onDelete\(habit\.id\)/);
});
