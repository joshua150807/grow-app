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

test('V2 hub shows three tappable cards and never auto-redirects', () => {
  const hub = read('./TrainingV2HubScreen.jsx');
  assert.doesNotMatch(hub, /router\.replace/);
  assert.doesNotMatch(hub, /getTrainingV2HubRedirect/);
  assert.match(hub, /Trainingsplan/);
  assert.match(hub, /Wähle deinen Bereich/);
  assert.match(hub, /Mein Training/);
  assert.match(hub, /Trainingspläne/);
  assert.match(hub, /Übungsbibliothek/);
  assert.match(hub, /TRAINING_V2_HUB_ICONS/);
  assert.match(hub, /onPress=\{openMyTraining\}/);
  assert.match(hub, /onPress=\{openPlans\}/);
  assert.match(hub, /onPress=\{openLibrary\}/);
  assert.match(hub, /pathname:\s*'\/tools\/training-v2-plan-detail'/);
  assert.match(hub, /pathname:\s*'\/tools\/training-v2-plans'/);
  assert.match(hub, /pathname:\s*'\/tools\/training-v2-library'/);
});

test('the hub only shows the fullscreen state view for a genuine first load or an error with no data yet, and stays mounted with cached data across a focus refetch (including one triggered by an interactive swipe-back remount)', () => {
  const hub = read('./TrainingV2HubScreen.jsx');
  // useTrainingV2Plans refetches on every focus (e.g. returning from a card, including via
  // an interactive iOS swipe-back that can tear down and recreate this screen's own state).
  // A `plans.length === 0` proxy on the old `loading` flag did not survive an actual
  // component remount, since a fresh instance's local state starts empty again — that is
  // what still left the cards untappable after a swipe-back. The hook's own module-level
  // cache now seeds a fresh mount's `plans` and keeps `initialLoading` false whenever that
  // cache already has data, so the hub never needs to special-case a remount itself.
  assert.doesNotMatch(hub, /if \(loading \|\| error\)/);
  assert.doesNotMatch(hub, /\(loading && plans\.length === 0\)/);
  assert.match(hub, /initialLoading/);
  assert.match(hub, /if \(initialLoading \|\| \(error && !hasPlans\)\)/);
  // A refetch failure with plans already showing must never replace the hub, so the error
  // view is only ever handed a real error when there is nothing else to show — but it is
  // still handed one then, so it can never be silently swallowed.
  assert.match(hub, /error=\{hasPlans \? null : error\}/);
  assert.match(hub, /onRetry=\{retry\}/);
});

test('the library route delegates to the isolated library screen, which is an honest placeholder with no muscle-group coupling and no legacy redirect', () => {
  const route = read('../../../../app/(tabs)/tools/training-v2-library.jsx');
  assert.match(route, /features\/tools\/training-v2\/screens\/TrainingV2LibraryScreen/);
  // The route now lives as a flat sibling directly under app/(tabs)/tools/ (not inside the
  // nested (training) group) — see the "single flat training-v2 stack" test below for why —
  // so it wraps itself with the shared background instead of inheriting one from a layout.
  assert.match(route, /TrainingV2Background/);

  const library = read('./TrainingV2LibraryScreen.jsx');
  assert.match(library, /Übungsbibliothek/);
  assert.match(library, /router\.back\(\)/);
  assert.doesNotMatch(library, /MUSCLE_GROUP_EXERCISES/);
  assert.doesNotMatch(library, /training-muscle-group/);
  assert.doesNotMatch(library, /fetch\(|\.from\(/);
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
  const route = read('../../../../app/(tabs)/tools/training-v2-plan-editor.jsx');
  assert.match(route, /features\/tools\/training-v2\/screens\/TrainingV2PlanEditorScreen/);
  assert.match(route, /TrainingV2Background/);

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
