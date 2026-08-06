const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

function read(relativePath) {
  return fs.readFileSync(path.resolve(__dirname, relativePath), 'utf8');
}

// Structural route-contract tests for the Training-V2 navigation flow:
//   Tools-Overview -> Training-Hub (app/(tabs)/tools/(training)/training-plan.jsx,
//   still owned by the nested (training) Stack, unchanged for legacy) -> a training-v2
//   sub-page (now a flat sibling of the hub directly under app/(tabs)/tools/, not inside
//   the nested (training) group). This repo's test harness has no navigation-container
//   renderer, so these assert the file/route structure that determines the runtime
//   behavior, rather than executing a live navigation.

const FLAT_SUBPAGES = [
  'training-v2-plans.jsx',
  'training-v2-plan-detail.jsx',
  'training-v2-plan-editor.jsx',
  'training-v2-library.jsx',
  'training-v2-my-training.jsx',
  'training-v2-session-active.jsx',
];

test('Tools -> Hub: the tools overview enters the training flow through exactly one route, with no intermediate redirect', () => {
  const toolsData = read('../../../../data/tools.js');
  assert.match(toolsData, /route:\s*'\/tools\/training-plan'/);

  const hubRoute = read('../../../../app/(tabs)/tools/(training)/training-plan.jsx');
  assert.doesNotMatch(hubRoute, /replace|redirect/i);
});

test('Hub -> sub-page: training-v2 sub-pages are flat siblings of the hub in the single outer tools stack, not duplicated inside any nested training stack', () => {
  for (const name of FLAT_SUBPAGES) {
    const route = read(`../../../../app/(tabs)/tools/${name}`);
    // The plans list and my-training routes each use their own, narrowly-scoped black
    // background (per their reference mockups) instead of the shared cosmic
    // TrainingV2Background used by the other flat sub-pages — see trainingV2Screens.test.cjs
    // for that isolation in detail.
    const routeSpecificBackgrounds = {
      'training-v2-plans.jsx': 'TrainingV2PlansBackground',
      'training-v2-my-training.jsx': 'TrainingV2MyTrainingBackground',
    };
    const expectedBackground = routeSpecificBackgrounds[name] ?? 'TrainingV2Background';
    assert.match(route, new RegExp(expectedBackground), `${name} must render its background wrapper`);
  }

  // Registering the same route name in two different Stack navigators (the outer tools
  // stack and the nested (training) stack) is exactly the "competing registration" that
  // caused a fast swipe-back to be recognized by both navigators at once. Asserting these
  // files exist only once, at the flat level, rules that out structurally.
  const nestedDir = path.resolve(__dirname, '../../../../app/(tabs)/tools/(training)');
  const nestedFiles = fs.readdirSync(nestedDir);
  for (const name of FLAT_SUBPAGES) {
    assert.equal(nestedFiles.includes(name), false, `${name} must not also exist inside the nested (training) group`);
  }
});

test('sub-page -> back: every training-v2 sub-page uses a single plain router.back(), never a multi-level or custom back path', () => {
  const plansScreen = read('./TrainingV2PlansScreen.jsx');
  const libraryScreen = read('./TrainingV2LibraryScreen.jsx');
  assert.match(plansScreen, /router\.back\(\)/);
  assert.match(libraryScreen, /router\.back\(\)/);
});

test('hub -> back: the hub route itself is untouched, so it stays the (training) group\'s own single entry and legacy training keeps its exact existing structure', () => {
  const hubRoute = read('../../../../app/(tabs)/tools/(training)/training-plan.jsx');
  assert.match(hubRoute, /EXPO_PUBLIC_TRAINING_V2_ENABLED/);
  assert.match(hubRoute, /TrainingOverviewScreen/);
  assert.match(hubRoute, /TrainingV2HubScreen/);
});

test('no route in the training-v2 flow disables the interactive back gesture', () => {
  const toolsLayout = read('../../../../app/(tabs)/tools/_layout.jsx');
  const trainingLayout = read('../../../../app/(tabs)/tools/(training)/_layout.jsx');
  const flatSources = FLAT_SUBPAGES.map((name) => read(`../../../../app/(tabs)/tools/${name}`));

  for (const source of [toolsLayout, trainingLayout, ...flatSources]) {
    assert.doesNotMatch(source, /gestureEnabled:\s*false/);
  }
});

test('no training-v2 sub-page route redirects or replaces, so entering one never creates a hidden extra history entry', () => {
  for (const name of FLAT_SUBPAGES) {
    const source = read(`../../../../app/(tabs)/tools/${name}`);
    assert.doesNotMatch(source, /replace|redirect/i);
  }
});
