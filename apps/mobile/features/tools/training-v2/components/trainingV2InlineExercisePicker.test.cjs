const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { transformFileSync } = require('@babel/core');
const transformModulesCommonJs = require('@babel/plugin-transform-modules-commonjs');
const transformReactJsx = require('@babel/plugin-transform-react-jsx');

function read(relativePath) {
  return fs.readFileSync(path.resolve(__dirname, relativePath), 'utf8');
}

// A JSX-capable sibling of ../testing/loadModule.cjs, kept local to this file rather than
// added to the shared helper: the shared loader is used by dozens of test files for plain
// .js modules and only needs the module-system transform, while actually executing this one
// .jsx component (to verify the real touch/blur event ordering, not just its source text)
// additionally needs a JSX transform. Scoping that here avoids changing behavior for every
// other test that already depends on the shared loader.
function loadJsxModule(fromDirectory, relativePath, mocks = {}) {
  const filename = path.resolve(fromDirectory, relativePath);
  const code = transformFileSync(filename, {
    babelrc: false,
    configFile: false,
    plugins: [[transformReactJsx, { runtime: 'automatic' }], transformModulesCommonJs],
  }).code;
  const module = { exports: {} };
  const localRequire = (request) => (
    Object.prototype.hasOwnProperty.call(mocks, request) ? mocks[request] : require(request)
  );
  new Function('require', 'module', 'exports', '__filename', '__dirname', code)(
    localRequire,
    module,
    module.exports,
    filename,
    path.dirname(filename),
  );
  return module.exports;
}

// Collects every JSX element in the tree (react/jsx-runtime element descriptors, not a real
// render) by walking props.children recursively — used to find a specific Pressable/
// TextInput by the props it was given, so a test can invoke its handlers directly in a
// chosen order (simulating a real touch sequence) without needing a full RN renderer.
function collectElements(node, found = []) {
  if (!node || typeof node !== 'object') return found;
  if (node.type) found.push(node);
  const children = node.props?.children;
  if (Array.isArray(children)) children.forEach((child) => collectElements(child, found));
  else if (children) collectElements(children, found);
  return found;
}

function createPickerHarness({ exercise, search, results = [] }) {
  const cells = [];
  const refs = [];
  let cellIndex = 0;
  let refIndex = 0;
  const react = {
    useState: (initial) => {
      const index = cellIndex++;
      if (!(index in cells)) cells[index] = typeof initial === 'function' ? initial() : initial;
      return [cells[index], (next) => {
        cells[index] = typeof next === 'function' ? next(cells[index]) : next;
      }];
    },
    useRef: (initial) => {
      const index = refIndex++;
      if (!refs[index]) refs[index] = { current: initial };
      return refs[index];
    },
    // The debounced live-search effect is irrelevant to the touch/blur race under test —
    // confirmTypedText/selectSuggestion call search()/dispatch() directly from the handlers
    // a test invokes, not through this effect — so it is a deliberate no-op here.
    useEffect: () => {},
  };
  const dispatched = [];
  const module = loadJsxModule(__dirname, './TrainingV2InlineExercisePicker.jsx', {
    react,
    'react-native': { Pressable: 'Pressable', Text: 'Text', TextInput: 'TextInput', View: 'View' },
    '../hooks/useTrainingV2ExercisePicker': {
      useTrainingV2ExercisePicker: () => ({
        results, exactMatch: null, search, reset: () => {},
      }),
    },
    '../styles/trainingV2Styles': { styles: new Proxy({}, { get: () => ({}) }) },
    '../utils/trainingV2ExerciseName': {
      cleanExerciseName: (name) => (name ?? '').trim().replace(/\s+/g, ' '),
    },
    '../utils/trainingV2MuscleGroups': {
      UI_MUSCLE_GROUPS: [{ value: 'legs', label: 'Beine' }, { value: 'other', label: 'Sonstiges' }],
      uiMuscleGroupLabel: (value) => value,
    },
  });

  function render() {
    cellIndex = 0;
    refIndex = 0;
    return module.TrainingV2InlineExercisePicker({
      dispatch: (action) => dispatched.push(action),
      logicalUnitKey: 'unit-1',
      logicalTargetExerciseKey: 'exercise-1',
      exercise,
    });
  }

  let tree = render();

  function find(typeName, predicate) {
    return collectElements(tree).find((el) => el.type === typeName && (!predicate || predicate(el.props)));
  }

  return {
    dispatched,
    rerender() { tree = render(); return tree; },
    find,
    findTextInput() { return find('TextInput'); },
    findSuggestionPressable() { return find('Pressable', (props) => typeof props.onPressIn === 'function'); },
    findPlaceholderPressable() { return find('Pressable', (props) => !props.onPressIn && !props.onPressOut); },
  };
}

function emptyExercise() {
  return {
    exerciseId: null, exerciseDraft: null, exerciseName: '', muscleGroup: 'other',
  };
}

test('no modal, no separate screen, no "Eigene Übung erstellen" button, and no direct exercise-creation call', () => {
  const picker = read('./TrainingV2InlineExercisePicker.jsx');
  assert.doesNotMatch(picker, /Modal|KeyboardAvoidingView/);
  assert.doesNotMatch(picker, /Eigene Übung erstellen/);
  assert.doesNotMatch(picker, /createTrainingV2Exercise/);
  assert.doesNotMatch(picker, /callTrainingV2\(|fetch\(/);
});

test('tapping the confirmed name or placeholder turns it into a text field and opens the dropdown while typing', () => {
  const picker = read('./TrainingV2InlineExercisePicker.jsx');
  assert.match(picker, /onPress=\{startEditing\}/);
  assert.match(picker, /autoFocus/);
  assert.match(picker, /showDropdown = editing && text\.trim\(\)\.length > 0/);
});

test('Fertig (submit) and blur both confirm the currently typed text via the same handler', () => {
  const picker = read('./TrainingV2InlineExercisePicker.jsx');
  assert.match(picker, /onBlur=\{confirmTypedText\}/);
  assert.match(picker, /onSubmitEditing=\{confirmTypedText\}/);
});

test('confirming re-checks the search fresh (not stale debounced state) and prefers an exact match over creating a draft', () => {
  const picker = read('./TrainingV2InlineExercisePicker.jsx');
  assert.match(picker, /const fresh = await search\(\{ search: cleaned \}\)/);
  assert.match(picker, /if \(fresh\.exactMatch\)/);
  assert.match(picker, /type: 'SET_EXERCISE_SELECTION'/);
  assert.match(picker, /type: 'SET_EXERCISE_DRAFT', logicalUnitKey, logicalTargetExerciseKey, name: cleaned/);
});

test('empty confirmed text or the X button both remove the entire exercise row via REMOVE_EXERCISE', () => {
  const picker = read('./TrainingV2InlineExercisePicker.jsx');
  assert.match(picker, /if \(!cleaned\) \{\s*dispatch\(\{ type: 'REMOVE_EXERCISE', logicalUnitKey, logicalTargetExerciseKey \}\);/);
  assert.match(picker, /function clearRow\(\)\s*\{\s*dispatch\(\{ type: 'REMOVE_EXERCISE', logicalUnitKey, logicalTargetExerciseKey \}\);/);
  assert.match(picker, /onPress=\{clearRow\}/);
});

test('a same-named system suggestion is labeled "Grow" and a private one "Eigene Übung"', () => {
  const picker = read('./TrainingV2InlineExercisePicker.jsx');
  assert.match(picker, /item\.scope === 'system' \? 'Grow' : 'Eigene Übung'/);
});

test('tapping a suggestion confirms it as a known exercise selection, resolving its muscle group', () => {
  const picker = read('./TrainingV2InlineExercisePicker.jsx');
  assert.match(picker, /function selectSuggestion\(item\)/);
  assert.match(picker, /exerciseId: item\.id/);
  assert.match(picker, /mainMuscle: item\.mainMuscle/);
});

test('a confirmed exercise shows a compact, tappable muscle-group row that dispatches SET_EXERCISE_MUSCLE_GROUP', () => {
  const picker = read('./TrainingV2InlineExercisePicker.jsx');
  assert.match(picker, /Muskelgruppe/);
  assert.match(picker, /uiMuscleGroupLabel\(exercise\.muscleGroup\)/);
  assert.match(picker, /type: 'SET_EXERCISE_MUSCLE_GROUP', logicalUnitKey, logicalTargetExerciseKey, muscleGroup: value/);
});

test('a suggestion tap is marked on touch-down (onPressIn) so blur can never win the race, and the mark is unconditionally cleared on release', () => {
  const picker = read('./TrainingV2InlineExercisePicker.jsx');
  assert.match(picker, /if \(suggestionTapRef\.current\) return;/);
  assert.match(picker, /onPressIn=\{\(\) => \{ suggestionTapRef\.current = true; \}\}/);
  assert.match(picker, /onPressOut=\{\(\) => \{ suggestionTapRef\.current = false; \}\}/);
  // No setTimeout/artificial delay is used to resolve the race.
  assert.doesNotMatch(picker, /setTimeout[\s\S]{0,120}(suggestionTap|confirmTypedText|selectSuggestion)/);
});

test('behavior: a suggestion tap (onPressIn, then a racing blur, then onPress) always wins — never a local draft for the partial text', async () => {
  const beinbeuger = {
    id: 'exercise-beinbeuger', name: 'Beinbeuger', scope: 'system', mainMuscle: 'hamstrings',
  };
  const harness = createPickerHarness({
    exercise: emptyExercise(),
    results: [beinbeuger],
    // If the blur-driven confirm ever ran despite a suggestion tap being marked, it would
    // call search() with the still-partial "bein" — failing here proves it did not.
    search: async () => { throw new Error('confirmTypedText must not run once a suggestion tap is marked'); },
  });

  harness.find('Pressable').props.onPress(); // tap "Übung auswählen …" -> start editing
  harness.rerender();
  harness.findTextInput().props.onChangeText('bein');
  harness.rerender();

  const suggestion = harness.findSuggestionPressable();
  assert.ok(suggestion, 'the Beinbeuger suggestion must be rendered while "bein" is typed');

  // The exact real-world race: touch-down on the suggestion, which natively blurs the
  // TextInput before the touch is released.
  suggestion.props.onPressIn();
  await harness.findTextInput().props.onBlur();
  suggestion.props.onPress();
  suggestion.props.onPressOut();

  assert.equal(harness.dispatched.length, 1);
  assert.deepEqual(harness.dispatched[0], {
    type: 'SET_EXERCISE_SELECTION',
    logicalUnitKey: 'unit-1',
    logicalTargetExerciseKey: 'exercise-1',
    exerciseId: 'exercise-beinbeuger',
    exerciseName: 'Beinbeuger',
    mainMuscle: 'hamstrings',
  });
});

test('behavior: the resolved muscle group always comes from the tapped suggestion itself, not the typed text', async () => {
  const kniebeuge = {
    id: 'exercise-kniebeuge', name: 'Kniebeuge', scope: 'user', mainMuscle: 'quadriceps',
  };
  const harness = createPickerHarness({
    exercise: emptyExercise(),
    results: [kniebeuge],
    search: async () => { throw new Error('must not be called'); },
  });
  harness.find('Pressable').props.onPress();
  harness.rerender();
  harness.findTextInput().props.onChangeText('knie');
  harness.rerender();

  const suggestion = harness.findSuggestionPressable();
  suggestion.props.onPressIn();
  await harness.findTextInput().props.onBlur();
  suggestion.props.onPress();

  assert.equal(harness.dispatched[0].mainMuscle, 'quadriceps');
  assert.equal(harness.dispatched[0].exerciseId, 'exercise-kniebeuge');
});

test('behavior: a normal blur with no suggestion tap still confirms the typed text as a local draft when nothing matches', async () => {
  const harness = createPickerHarness({
    exercise: emptyExercise(),
    results: [],
    search: async () => ({ results: [], exactMatch: null }),
  });
  harness.find('Pressable').props.onPress();
  harness.rerender();
  harness.findTextInput().props.onChangeText('ganz neue übung');
  harness.rerender();

  await harness.findTextInput().props.onBlur();

  assert.equal(harness.dispatched.length, 1);
  assert.equal(harness.dispatched[0].type, 'SET_EXERCISE_DRAFT');
  assert.equal(harness.dispatched[0].name, 'ganz neue übung');
});

test('the exercise editor card hosts the inline picker directly, with no onPickExercise bubbling to a parent modal', () => {
  const card = read('./TrainingV2ExerciseEditorCard.jsx');
  assert.match(card, /<TrainingV2InlineExercisePicker/);
  assert.doesNotMatch(card, /onPickExercise/);

  const unitCard = read('./TrainingV2UnitEditorCard.jsx');
  assert.doesNotMatch(unitCard, /onPickExercise/);
});
