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

test('isolated V2 code contains no legacy service, table or lifecycle-mutation references', () => {
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
  assert.doesNotMatch(source, /\.from\(|training_plans_v2/i);
  // `importedFromLegacyPlan` is the shared contract's own required target-set field
  // (packages/shared/src/training/contracts.ts) carried through unmodified from the
  // server; it is not a reference to the legacy training module and must stay excluded
  // from this otherwise case-insensitive "legacy" guard.
  assert.doesNotMatch(source, /(?<!importedFrom)[Ll]egacy(?!Plan\b)/);
  // C3a intentionally introduces the two in-scope mutations (create via POST, edit via
  // PATCH). Everything else stays forbidden: no PUT/DELETE, and no lifecycle actions
  // (activate/schedule/reactivate/archive/weekly-goal) anywhere in the isolated module.
  assert.doesNotMatch(source, /method:\s*['"](PUT|DELETE)['"]/);
  assert.doesNotMatch(source, /\/(activate|schedule|reactivate|archive|weekly-goal)\b/);
  assert.doesNotMatch(source, /Aktivieren|Vormerken|Archivieren|Reaktivieren/);
  assert.doesNotMatch(source, /\b(createTrainingPlan|updateTrainingPlan|activateTrainingPlan|archiveTrainingPlan|scheduleTrainingPlan|reactivateTrainingPlan)\b/);
  assert.match(source, /method:\s*['"]POST['"]/);
  assert.match(source, /method:\s*['"]PATCH['"]/);
});

test('the editor route delegates to the isolated editor screen and is reachable from list and detail', () => {
  const route = read('../../../../app/(tabs)/tools/(training)/training-v2-plan-editor.jsx');
  assert.match(route, /features\/tools\/training-v2\/screens\/TrainingV2PlanEditorScreen/);

  const list = read('./TrainingV2PlansScreen.jsx');
  const detail = read('./TrainingV2PlanDetailScreen.jsx');
  assert.match(list, /training-v2-plan-editor/);
  assert.match(detail, /training-v2-plan-editor/);
  assert.match(detail, /planId/);
});

test('editor screen guards unsaved changes, deduplicates save and navigates to detail on success', () => {
  const editor = read('./TrainingV2PlanEditorScreen.jsx');
  assert.match(editor, /beforeRemove/);
  assert.match(editor, /Ungespeicherte Änderungen/);
  assert.match(editor, /disabled=\{saving\}/);
  assert.match(editor, /router\.replace\(\{\s*pathname:\s*'\/tools\/training-v2-plan-detail'/);
  assert.doesNotMatch(editor, /Aktivieren|Vormerken|Archivieren|Reaktivieren/);
});
