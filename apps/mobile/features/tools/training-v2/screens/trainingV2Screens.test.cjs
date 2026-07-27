const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { loadModule } = require('../testing/loadModule.cjs');

function read(relativePath) {
  return fs.readFileSync(path.resolve(__dirname, relativePath), 'utf8');
}

test('feature flag keeps the legacy hub default and selects V2 only for exact true', (context) => {
  const previous = process.env.EXPO_PUBLIC_TRAINING_V2_ENABLED;
  context.after(() => {
    if (previous === undefined) delete process.env.EXPO_PUBLIC_TRAINING_V2_ENABLED;
    else process.env.EXPO_PUBLIC_TRAINING_V2_ENABLED = previous;
  });
  const LegacyScreen = () => null;
  const V2Screen = () => null;
  const mocks = {
    '../../../../features/tools/training/screens/TrainingOverviewScreen': {
      __esModule: true,
      default: LegacyScreen,
    },
    '../../../../features/tools/training-v2/screens/TrainingV2HubScreen': {
      __esModule: true,
      default: V2Screen,
    },
  };
  const routePath = '../../../../app/(tabs)/tools/(training)/training-plan.jsx';

  for (const value of ['', 'false', 'TRUE']) {
    process.env.EXPO_PUBLIC_TRAINING_V2_ENABLED = value;
    assert.equal(loadModule(__dirname, routePath, mocks).default, LegacyScreen);
  }
  process.env.EXPO_PUBLIC_TRAINING_V2_ENABLED = 'true';
  assert.equal(loadModule(__dirname, routePath, mocks).default, V2Screen);
});

test('V2 hub replaces to the plan list only after a successful load without an active plan', () => {
  const hub = read('./TrainingV2HubScreen.jsx');
  assert.match(hub, /getTrainingV2HubRedirect/);
  assert.match(hub, /router\.replace\(redirect\)/);
  assert.match(hub, /Mein Training/);
});

test('plan list covers empty, status sections, raw schedule and collapsed archive', () => {
  const sections = read('../components/TrainingV2PlanSections.jsx');
  const card = read('../components/TrainingV2PlanCard.jsx');
  assert.match(sections, /Noch keine Trainingspläne/);
  assert.match(sections, /\['active', 'Active'\]/);
  assert.match(sections, /\['scheduled', 'Scheduled'\]/);
  assert.match(sections, /\['draft', 'Drafts'\]/);
  assert.match(sections, /useTrainingV2ArchiveVisibility/);
  assert.match(card, /plan\.schedule\.startDate/);
  assert.match(card, /plan\.schedule\.timeZone/);
  assert.doesNotMatch(card, /DateTimeFormat|toLocale|new Date/);
});

test('plan screens wire the behavior-tested hooks to pull-to-refresh controls', () => {
  assert.match(read('./TrainingV2PlansScreen.jsx'), /RefreshControl/);
  assert.match(read('./TrainingV2PlanDetailScreen.jsx'), /RefreshControl/);
});

test('detail is read-only and exposes revision, units, unit type, exercises and sets', () => {
  const detail = read('./TrainingV2PlanDetailScreen.jsx');
  assert.match(detail, /revision\.revisionNumber/);
  assert.match(detail, /plan\.units\.map/);
  assert.match(detail, /unit\.unitTypeLabel/);
  assert.match(detail, /exercise\.exerciseName/);
  assert.match(detail, /exercise\.targetSets\.map/);
  assert.doesNotMatch(detail, /Edit|Aktivieren|Vormerken|Archivieren|Reaktivieren/);
});

test('isolated V2 code contains no legacy service, table or mutation references', () => {
  const root = path.resolve(__dirname, '..');
  const files = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(target);
      else if (!entry.name.endsWith('.test.cjs')) files.push(target);
    }
  };
  visit(root);
  const source = files.map((file) => fs.readFileSync(file, 'utf8')).join('\n');

  assert.doesNotMatch(source, /trainingService|trainingPlanStorage|trainingDraftStorage/);
  assert.doesNotMatch(source, /\.from\(|training_plans_v2|legacy/i);
  assert.doesNotMatch(source, /method:\s*['"](POST|PUT|PATCH|DELETE)['"]/);
  assert.doesNotMatch(source, /createTrainingPlan|updateTrainingPlan|activateTrainingPlan|archiveTrainingPlan/);
});
