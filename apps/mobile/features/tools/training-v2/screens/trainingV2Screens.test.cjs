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

test('detail exposes revision, units, unit type, exercises and sets read-only, with no workout/session logging', () => {
  const detail = read('./TrainingV2PlanDetailScreen.jsx');
  assert.match(detail, /revision\.revisionNumber/);
  assert.match(detail, /plan\.units\.map/);
  assert.match(detail, /unit\.unitTypeLabel/);
  assert.match(detail, /exercise\.exerciseName/);
  assert.match(detail, /exercise\.targetSets\.map/);
  assert.doesNotMatch(detail, /session|workout|logSet|completeSet/i);
});

test('detail shows plan actions gated by status, confirms destructive/status-changing actions and never mutates optimistically', () => {
  const detail = read('./TrainingV2PlanDetailScreen.jsx');
  assert.match(detail, /TrainingV2PlanActionsPanel/);
  assert.match(detail, /status=\{plan\.status\}/);
  assert.match(detail, /pending=\{actions\.pending\}/);
  // Activate/archive/reactivate are simple one-tap toggles, so each is gated behind an
  // explicit native confirm dialog before the mutation ever runs.
  assert.match(detail, /Alert\.alert/);
  assert.match(detail, /actions\.activate\(plan\.version\)/);
  assert.match(detail, /actions\.archive\(plan\.version\)/);
  assert.match(detail, /actions\.reactivate\(plan\.version\)/);
  // Schedule and weekly-goal take additional input, so their own modal + explicit
  // confirm button serves as the confirmation step instead of a second Alert.
  assert.match(detail, /TrainingV2ScheduleModal/);
  assert.match(detail, /TrainingV2WeeklyGoalModal/);
  assert.match(detail, /actions\.schedule\(plan\.version, startDate, timeZone\)/);
  assert.match(detail, /actions\.updateWeeklyGoal\(plan\.version, weeklyGoal\)/);
  // No optimistic local mutation of `plan` — only the hook's onSuccess (applyServerPlan,
  // fed by the real server response) is ever allowed to change what is displayed.
  assert.doesNotMatch(detail, /setPlan\(/);
  // 409 conflict never overwrites the current view; reload only fires on user action.
  assert.match(detail, /actions\.conflict/);
  assert.match(detail, /onPress=\{handleReload\}/);
  // A schedule/weekly-goal modal only closes via the shared, testable decision helper —
  // never via a bare `outcome.ok` check reimplemented inline in the screen.
  assert.match(detail, /shouldClosePlanActionModal\(outcome\)/);
  assert.doesNotMatch(detail, /if \(outcome\.ok\)/);
  // Each modal receives the current action error so it can render it itself while it
  // stays open, instead of relying on the screen-level banner hidden behind it.
  assert.match(detail, /error=\{scheduleModalVisible \? actions\.error : null\}/);
  assert.match(detail, /error=\{weeklyGoalModalVisible \? actions\.error : null\}/);
});

test('schedule and weekly-goal modals render the action error inline while staying open', () => {
  const scheduleModal = read('../components/TrainingV2ScheduleModal.jsx');
  const weeklyGoalModal = read('../components/TrainingV2WeeklyGoalModal.jsx');
  assert.match(scheduleModal, /error \? <Text style=\{styles\.formErrorText\}>\{error\.message\}<\/Text> : null/);
  assert.match(weeklyGoalModal, /error \? <Text style=\{styles\.formErrorText\}>\{error\.message\}<\/Text> : null/);
});

test('modal inputs only reset when the modal newly opens (or its seed value changes), never merely because of an error', () => {
  const scheduleModal = read('../components/TrainingV2ScheduleModal.jsx');
  const weeklyGoalModal = read('../components/TrainingV2WeeklyGoalModal.jsx');
  // The reset effects depend only on [visible] / [visible, currentValue] — `error` and
  // `pending` are not in either dependency list, so a failed attempt can never wipe
  // out what the user already picked/typed while the modal stays open.
  assert.match(scheduleModal, /useEffect\(\(\) => \{\s*if \(visible\) setDate\(new Date\(\)\);\s*\}, \[visible\]\);/);
  assert.match(weeklyGoalModal, /\}, \[visible, currentValue\]\);/);
  assert.doesNotMatch(scheduleModal, /\[visible, error\]|\[error, visible\]/);
  assert.doesNotMatch(weeklyGoalModal, /\[visible, currentValue, error\]|\[error, visible, currentValue\]/);
});

test('isolated V2 code contains no legacy service or table references, and only the fully-wired mutations are reachable', () => {
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
  // No DELETE anywhere; C3b intentionally adds PUT (weekly-goal) alongside the existing
  // POST (create/activate/schedule/reactivate/archive) and PATCH (edit).
  assert.doesNotMatch(source, /method:\s*['"]DELETE['"]/);
  // Never the bare legacy-service function names (createTrainingPlan, updateTrainingPlan,
  // activateTrainingPlan, ...) — the V2 module always uses its own `*TrainingV2*` names.
  assert.doesNotMatch(source, /\b(createTrainingPlan|updateTrainingPlan|activateTrainingPlan|archiveTrainingPlan|scheduleTrainingPlan|reactivateTrainingPlan)\b/);
  assert.match(source, /method:\s*['"]POST['"]/);
  assert.match(source, /method:\s*['"]PATCH['"]/);
  assert.match(source, /method:\s*['"]PUT['"]/);
  assert.match(source, /\/activate/);
  assert.match(source, /\/schedule/);
  assert.match(source, /\/reactivate/);
  assert.match(source, /\/archive/);
  assert.match(source, /\/weekly-goal/);
});

test('schedule modal sends a local YYYY-MM-DD date and the device IANA zone without any client-side UTC math', () => {
  const modal = read('../components/TrainingV2ScheduleModal.jsx');
  assert.match(modal, /getTrainingV2DeviceTimeZone/);
  assert.match(modal, /toLocalDateString/);
  assert.match(modal, /onConfirm\(toLocalDateString\(date\), timeZone\)/);
  assert.doesNotMatch(modal, /toISOString|getUTCFullYear|getUTCMonth|getUTCDate|getTimezoneOffset/);

  const timeZoneHelper = read('../services/trainingV2DeviceTimeZone.js');
  assert.match(timeZoneHelper, /resolvedOptions\(\)\.timeZone/);
  assert.match(timeZoneHelper, /getFullYear|getMonth|getDate/);
  assert.doesNotMatch(timeZoneHelper, /toISOString|getUTCFullYear|getUTCMonth|getUTCDate|getTimezoneOffset/);
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
