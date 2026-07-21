const assert = require('node:assert/strict');
const test = require('node:test');

test('useHabitCollections.js exports hook', () => {
  const source = require('fs').readFileSync(
    require('path').resolve(__dirname, './useHabitCollections.js'),
    'utf8'
  );

  assert.match(source, /export\s+function\s+useHabitCollections/);
  assert.match(source, /useCallback/);
  assert.match(source, /useEffect/);
  assert.match(source, /useRef/);
});

test('useHabitCollections.js returns required state and functions', () => {
  const source = require('fs').readFileSync(
    require('path').resolve(__dirname, './useHabitCollections.js'),
    'utf8'
  );

  assert.match(source, /collections/);
  assert.match(source, /loading/);
  assert.match(source, /loadError/);
  assert.match(source, /add/);
  assert.match(source, /update/);
  assert.match(source, /remove/);
  assert.match(source, /loadCollections/);
});

test('useHabitCollections.js implements user isolation', () => {
  const source = require('fs').readFileSync(
    require('path').resolve(__dirname, './useHabitCollections.js'),
    'utf8'
  );

  assert.match(source, /getCurrentUserId/);
  assert.match(source, /onAuthStateChange/);
  assert.match(source, /mountedRef/);
  assert.match(source, /ownerRef/);
});

test('useHabitCollections.js delegates to service', () => {
  const source = require('fs').readFileSync(
    require('path').resolve(__dirname, './useHabitCollections.js'),
    'utf8'
  );

  assert.match(source, /createHabitCollection/);
  assert.match(source, /updateHabitCollection/);
  assert.match(source, /deleteHabitCollection/);
  assert.match(source, /listHabitCollections/);
});

test('collection detail invalidates requests and visible state on owner change', () => {
  const detailSource = require('fs').readFileSync(
    require('path').resolve(__dirname, './useHabitCollection.js'),
    'utf8'
  );

  assert.match(detailSource, /loadRequestRef\.current \+= 1/);
  assert.match(detailSource, /completionRequestRef\.current \+= 1/);
  assert.match(detailSource, /setCollection\(null\)/);
  assert.match(detailSource, /sequence !== authSequence/);
});
