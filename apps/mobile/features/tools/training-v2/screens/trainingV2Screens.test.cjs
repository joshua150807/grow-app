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
  // "Mein Training" always opens the same flat sub-page now, unconditionally — which plan (if
  // any) it acts on, and which unit it suggests, is TrainingV2MyTrainingScreen's own decision
  // (via useTrainingV2Plans + the plan-detail read's nextUnit), not something the hub computes.
  assert.doesNotMatch(hub, /findActiveTrainingV2Plan/);
  assert.match(hub, /pathname:\s*'\/tools\/training-v2-my-training'/);
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
  assert.match(hub, /if \(initialLoading\)/);
  assert.match(hub, /\{error \? <TrainingV2StateView error=\{error\} onRetry=\{retry\} \/> : null\}/);
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

test('the overview shows two flat lists — "Grow-Trainingspläne" (every active template) and "Gespeicherte Pläne" (the caller\'s pre-filtered savedPlans) — with no status sections and no archive UI', () => {
  const sections = read('../components/TrainingV2PlanSections.jsx');
  const card = read('../components/TrainingV2PlanCard.jsx');

  assert.match(sections, /Grow-Trainingspläne/);
  assert.match(sections, /Gespeicherte Pläne/);
  assert.match(sections, /Noch keine gespeicherten Pläne/);
  // Sections is a pure renderer: it maps whatever savedPlans/templates it was handed — the
  // filtering itself (selectTrainingV2SavedPlans) lives in trainingV2ViewModel.js, not here,
  // so a self-created plan can never disappear from the list just because it was archived.
  assert.match(sections, /templates\.map\(/);
  assert.match(sections, /savedPlans\.map\(/);
  assert.doesNotMatch(sections, /\.filter\(/);
  assert.doesNotMatch(sections, /!==\s*'archived'/);
  // No more grouped status sections or a collapsible archive toggle in this step.
  assert.doesNotMatch(sections, /groupTrainingV2Plans/);
  assert.doesNotMatch(sections, /useTrainingV2ArchiveVisibility/);
  assert.doesNotMatch(sections, /styles\.archiveToggle/);
  assert.doesNotMatch(sections, /'Aktiv'|'Geplant'|'Entwürfe'/);

  assert.match(card, /plan\.schedule\.startDate/);
  assert.doesNotMatch(card, /DateTimeFormat|toLocale|new Date/);
  // The IANA time zone is a technical raw value and must not be a prominent, always-visible
  // main info on the compact card (it remains available on the untouched detail screen).
  assert.doesNotMatch(card, /plan\.schedule\.timeZone/);
});

test('the Overview\'s Grow-Trainingspläne section shows every active template regardless of saved/active state, and the Gespeicherte Pläne section is exactly selectTrainingV2SavedPlans(plans)', () => {
  const screen = read('./TrainingV2PlansScreen.jsx');
  assert.match(screen, /useTrainingV2Templates/);
  assert.match(screen, /selectTrainingV2SavedPlans\(plans\)/);
  assert.match(screen, /templates=\{templates\}/);
  assert.match(screen, /savedPlans=\{savedPlans\}/);
});

test('only the active plan gets the "Aktiv" badge — scheduled and draft plans render no status badge at all', () => {
  const card = read('../components/TrainingV2PlanCard.jsx');
  assert.match(card, /isActive \? \(/);
  assert.match(card, />Aktiv</);
  // No per-status label map or icon map survives — active is the only status this card ever
  // labels, so there is nothing to look up for scheduled/draft/archived.
  assert.doesNotMatch(card, /PLAN_STATUS_LABELS_DE/);
  assert.doesNotMatch(card, /STATUS_ICONS/);
  assert.doesNotMatch(card, /'Geplant'|'Entwurf'|'Archiviert'/);
  assert.doesNotMatch(card, /from\s+'\.\.\/models\/trainingV2ViewModel'/);
  const viewModel = read('../models/trainingV2ViewModel.js');
  assert.match(viewModel, /active:\s*'Active'/, 'the shared PLAN_STATUS_LABELS must stay in English for the plan detail screen, and is otherwise untouched');
});

test('the plans header has no leftover unicode arrows and no plus button, and its styles stay isolated from the hub, plan detail, editor and library screens', () => {
  const screen = read('./TrainingV2PlansScreen.jsx');
  const sections = read('../components/TrainingV2PlanSections.jsx');
  const card = read('../components/TrainingV2PlanCard.jsx');

  for (const source of [screen, sections, card]) {
    assert.match(source, /@expo\/vector-icons/);
    assert.doesNotMatch(source, /[‹›−]/);
  }
  assert.doesNotMatch(screen, />\s*\+\s*Neuer Plan/);
  // The header's own quick-create action was removed entirely this round — the hero card is
  // the only way to reach the create-flow from this screen now.
  assert.doesNotMatch(screen, /accessibilityLabel="Neuen Plan erstellen"/);
  assert.doesNotMatch(screen, /name="add"/);
  assert.doesNotMatch(screen, /styles\.plansHeaderAction/);

  assert.match(screen, /name="chevron-back"/);
  assert.match(card, /name="chevron-forward"/);

  // The header lives on new, screen-local style keys (plansHeaderRow/plansBackRow/
  // plansHeaderTitle), not on the topRow/title/subtitle/editorLink keys shared with the hub,
  // plan detail, editor and library screens — so this redesign cannot visually affect them.
  assert.match(screen, /styles\.plansHeaderRow/);
  assert.match(screen, /styles\.plansBackRow/);
  assert.match(screen, /styles\.plansHeaderTitle/);
  assert.match(screen, /styles\.backText/);
  assert.doesNotMatch(screen, /styles\.topRow\b/);
  assert.doesNotMatch(screen, /styles\.title\b/);
  assert.doesNotMatch(screen, /styles\.editorLink\b/);

  // The empty state also uses a screen-local style (plansEmptyCard/...), not the emptyCard/
  // emptyTitle/emptyText keys the library screen's placeholder still relies on.
  assert.match(sections, /styles\.plansEmptyCard/);
  assert.doesNotMatch(sections, /styles\.emptyCard\b/);

  // The plans route (not the screen file itself) owns its own black-background wrapper,
  // isolated from the shared cosmic TrainingV2Background the hub and other sub-pages use.
  const plansRoute = read('../../../../app/(tabs)/tools/training-v2-plans.jsx');
  assert.match(plansRoute, /TrainingV2PlansBackground/);
  assert.doesNotMatch(plansRoute, /TrainingV2Background['"]/);
  const plansBackground = read('../components/TrainingV2PlansBackground.jsx');
  assert.match(plansBackground, /COLORS\.background/);
  assert.doesNotMatch(plansBackground, /TRAINING_PAGE_BG|ImageBackground/);

  const hubRoute = read('../../../../app/(tabs)/tools/(training)/training-plan.jsx');
  assert.doesNotMatch(hubRoute, /TrainingV2PlansBackground/);
  const trainingV2Background = read('../components/TrainingV2Background.jsx');
  assert.match(trainingV2Background, /TRAINING_PAGE_BG/, 'the shared cosmic background used by the hub and other sub-pages must stay untouched');
});

test('the plans list has a wrapping header title and a fully-pressable, fully-readable create-plan card, plus a neutral image slot on every card', () => {
  const screen = read('./TrainingV2PlansScreen.jsx');
  const card = read('../components/TrainingV2PlanCard.jsx');

  // The iPhone correction separates Back and title; dynamic text may wrap.
  assert.doesNotMatch(screen, /styles\.plansHeaderTitle\} numberOfLines/);
  assert.match(screen, /accessibilityLabel="Zurück"/);
  assert.match(screen, /resizeMode="contain"/);

  // Hero: the confirmed source asset, wrapped in a single Pressable (fully tappable),
  // navigating to the existing plan editor create-flow — no separate icon/border drawn on
  // top of it, since the asset already bakes in its own outline, pencil icon and chevron.
  // Its description text has no numberOfLines cap, so it is never truncated.
  assert.match(screen, /TRAINING_V2_CREATE_PLAN_HERO/);
  assert.match(screen, /Eigenen Plan erstellen/);
  assert.match(screen, /onPress=\{openEditor\}/g);
  assert.match(screen, /pathname:\s*'\/tools\/training-v2-plan-editor'/);
  assert.doesNotMatch(screen, /styles\.heroSubtitle\}\s*numberOfLines/);

  // Every card gets the same neutral image slot (no per-plan image field exists in the
  // model), via a nullable presentation prop that defaults to the placeholder — never a
  // fake, plan-specific image.
  assert.match(card, /function PlanThumbnail\(\{ imageSource \}\)/);
  assert.match(card, /name="barbell-outline"/);
  assert.match(card, /styles\.planThumbnailPlaceholder/);
  assert.doesNotMatch(card, /plan\.image|plan\.thumbnail|plan\.photo/i);
});

test('the hero source asset is a committed webp, not a PNG, at the confirmed path', () => {
  const assetDir = path.resolve(__dirname, '../../../../assets/tool-icons/training-v2');
  const files = fs.readdirSync(assetDir);
  assert.ok(files.includes('training-v2-create-plan-hero.webp'));
  assert.equal(files.some((name) => name.toLowerCase().endsWith('.png')), false, 'no PNG must ever be committed to this asset folder');

  const stat = fs.statSync(path.join(assetDir, 'training-v2-create-plan-hero.webp'));
  assert.ok(stat.size < 200 * 1024, `hero webp must stay under 200KB, was ${stat.size} bytes`);

  const toolAssets = read('../../../../constants/toolAssets.js');
  assert.match(toolAssets, /TRAINING_V2_CREATE_PLAN_HERO\s*=\s*require\('\.\.\/assets\/tool-icons\/training-v2\/training-v2-create-plan-hero\.webp'\)/);
});

test('plan screens wire the behavior-tested hooks to pull-to-refresh controls', () => {
  assert.match(read('./TrainingV2PlansScreen.jsx'), /RefreshControl/);
  assert.match(read('./TrainingV2OwnPlanDetail.jsx'), /RefreshControl/);
  assert.match(read('./TrainingV2GrowPlanDetail.jsx'), /RefreshControl/);
});

test('the plan-detail route dispatches on templateId vs planId: every Grow entry (Grow-Trainingspläne list or a saved/active Grow instance) opens by templateId, every own plan opens by planId', () => {
  const dispatcher = read('./TrainingV2PlanDetailScreen.jsx');
  assert.match(dispatcher, /if \(templateId\) return <TrainingV2GrowPlanDetail templateId=\{templateId\} planId=\{planId\} \/>;/);
  assert.match(dispatcher, /return <TrainingV2OwnPlanDetail planId=\{planId\} \/>;/);

  const screen = read('./TrainingV2PlansScreen.jsx');
  assert.match(screen, /plan\?\.sourceTemplateId/);
  assert.match(screen, /params:\s*\{\s*templateId, \.\.\.\(planId \? \{ planId \} : \{\}\)\s*\}/);
  assert.match(screen, /params:\s*\{\s*planId\s*\}/);
});

test('detail exposes revision/units/unit type/exercises/sets read-only, with no workout/session logging, on both the own-plan and the Grow-plan detail screen', () => {
  const ownDetail = read('./TrainingV2OwnPlanDetail.jsx');
  assert.match(ownDetail, /revision\.revisionNumber/);
  assert.match(ownDetail, /plan\.units\.map/);
  assert.match(ownDetail, /unit\.unitTypeLabel/);
  assert.match(ownDetail, /exercise\.exerciseName/);
  assert.match(ownDetail, /exercise\.targetSets\.map/);
  assert.doesNotMatch(ownDetail, /session|workout|logSet|completeSet/i);

  const growDetail = read('./TrainingV2GrowPlanDetail.jsx');
  assert.match(growDetail, /template\.units\.map/);
  assert.match(growDetail, /unit\.unitTypeLabel/);
  assert.match(growDetail, /exercise\.exerciseName/);
  assert.match(growDetail, /exercise\.targetSets\.map/);
  assert.doesNotMatch(growDetail, /session|workout|logSet|completeSet/i);
});

test('own-plan detail has no Wochenziel, Vormerken or Archivieren left — only an "Aktiv" badge and a single unified "Jetzt aktivieren", gated behind a confirm only when a different plan is currently active', () => {
  const detail = read('./TrainingV2OwnPlanDetail.jsx');
  assert.doesNotMatch(detail, /Wochenziel/);
  assert.doesNotMatch(detail, /Vormerken/);
  assert.doesNotMatch(detail, /Archivieren/);
  assert.doesNotMatch(detail, /TrainingV2PlanActionsPanel/);
  assert.doesNotMatch(detail, /TrainingV2ScheduleModal/);
  assert.doesNotMatch(detail, /TrainingV2WeeklyGoalModal/);
  assert.doesNotMatch(detail, /actions\.schedule\(/);
  assert.doesNotMatch(detail, /actions\.archive\(/);
  assert.doesNotMatch(detail, /actions\.updateWeeklyGoal\(/);

  assert.match(detail, /Jetzt aktivieren/);
  assert.match(detail, />Aktiv</);
  assert.match(detail, /isActive \? \(/);
  // Reactivate (archived) and activate (draft/scheduled) are unified under one button/label —
  // the screen itself still picks the correct server call per the API's own status gates.
  assert.match(detail, /plan\.status === 'archived' \? actions\.reactivate : actions\.activate/);
  // Warn only when a *different* plan is actually active — not unconditionally on every tap.
  assert.match(detail, /candidate\.status === 'active' && candidate\.id !== planId/);
  assert.match(detail, /if \(!otherActivePlan\) \{/);
  assert.match(detail, /Alert\.alert\(/);
  // No optimistic local mutation of `plan` — only the hook's onSuccess (applyServerPlan, fed
  // by the real server response) is ever allowed to change what is displayed.
  assert.doesNotMatch(detail, /setPlan\(/);
  // 409 conflict never overwrites the current view; reload only fires on user action.
  assert.match(detail, /actions\.conflict/);
  assert.match(detail, /onPress=\{handleReload\}/);
});

test('the "Plan löschen" button only renders for an own plan (sourceTemplateId === null), never for a Grow-sourced plan, and is not gated on active/inactive status', () => {
  const detail = read('./TrainingV2OwnPlanDetail.jsx');
  assert.match(detail, /plan\.sourceTemplateId === null \? \(/);
  assert.match(detail, />Plan löschen</);
  assert.match(detail, /styles\.actionButtonDanger/);
  // The delete panel's own JSX block must not additionally depend on `isActive` — a plan may
  // be deleted whether or not it is currently active.
  const deleteBlock = detail.slice(detail.indexOf('plan.sourceTemplateId === null'));
  assert.doesNotMatch(deleteBlock.slice(0, deleteBlock.indexOf('</ScrollView>')), /isActive/);

  // Never reachable on the Grow-template detail screen — Grow content is never deletable.
  const growDetail = read('./TrainingV2GrowPlanDetail.jsx');
  assert.doesNotMatch(growDetail, /Plan löschen/);
  assert.doesNotMatch(growDetail, /actions\.remove/);
});

test('deleting a plan shows a confirm dialog with exactly Abbrechen/Plan löschen, only calls actions.remove() on the destructive confirm — Abbrechen has no onPress and deletes nothing', () => {
  const detail = read('./TrainingV2OwnPlanDetail.jsx');
  assert.match(detail, /Alert\.alert\(\s*'Plan löschen',/);
  assert.match(detail, /\{ text: 'Abbrechen', style: 'cancel' \}/);
  assert.match(detail, /\{ text: 'Plan löschen', style: 'destructive', onPress: runDelete \}/);
  // The cancel entry is a plain object literal with only text/style — no onPress at all, so
  // dismissing the dialog can never trigger any deletion path.
  assert.doesNotMatch(detail, /\{ text: 'Abbrechen', style: 'cancel', onPress/);
});

test('a successful delete clears the edit draft and the owner\'s plans cache, then navigates back to the Overview exactly once via replace() — never back(), never more than once', () => {
  const detail = read('./TrainingV2OwnPlanDetail.jsx');
  assert.match(detail, /await actions\.remove\(\)|actions\.remove\(\)\.then/);
  assert.match(detail, /clearTrainingV2Draft\(draftOwnerId, 'edit', planId\)/);
  assert.match(detail, /setCachedTrainingV2Plans\(cacheOwnerId, cachedPlans\.filter/);
  assert.match(detail, /router\.replace\(\{ pathname: '\/tools\/training-v2-plans' \}\)/);
  // Exactly one replace() call site in the whole file, and it is the only navigation inside
  // finishDelete — never router.back() for this flow.
  assert.equal((detail.match(/router\.replace\(/g) ?? []).length, 1);
  const finishDeleteBody = detail.slice(detail.indexOf('const finishDelete'), detail.indexOf('const runDelete'));
  assert.doesNotMatch(finishDeleteBody, /router\.back\(\)/);
});

test('finishDelete (draft clear, cache update, navigation) only ever runs when the delete actually succeeded — a failed delete leaves the detail screen open with the action error visible', () => {
  const detail = read('./TrainingV2OwnPlanDetail.jsx');
  assert.match(detail, /if \(outcome\.ok\) void finishDelete\(\);/);
  // The same actions.error banner used by every other action (activate, etc.) also covers a
  // failed remove() — no separate/duplicate error UI was added for delete.
  assert.match(detail, /actions\.error && !actions\.conflict/);
  assert.match(detail, /\{actionErrorMessage\(actions\.error\)\}/);
});

test('Grow-plan detail has Speichern/Nicht mehr speichern and Jetzt aktivieren, an "Aktiv" badge, no edit flow, and activating never auto-saves while unsaving never deactivates', () => {
  const detail = read('./TrainingV2GrowPlanDetail.jsx');
  assert.match(detail, /Speichern/);
  assert.match(detail, /Nicht mehr speichern/);
  assert.match(detail, /Jetzt aktivieren/);
  assert.match(detail, />Aktiv</);
  assert.match(detail, /template\.isActive \? \(/);
  assert.doesNotMatch(detail, /training-v2-plan-editor/);
  assert.doesNotMatch(detail, /Bearbeiten/);
  assert.doesNotMatch(detail, /Wochenziel|Vormerken|Archivieren/);

  // handleActivate only ever calls actions.activate(); handleToggleSaved only ever calls
  // actions.save()/actions.unsave() — no handler calls more than one of the three, so
  // activating can never implicitly save and unsaving can never implicitly deactivate.
  assert.match(detail, /void actions\.activate\(\);/);
  assert.match(detail, /template\.isSaved \? actions\.unsave\(\) : actions\.save\(\)/);

  // Warn only when a *different* plan is actually active — not unconditionally on every tap.
  assert.match(detail, /candidate\.status === 'active' && candidate\.id !== template\.userPlanId/);
  assert.match(detail, /if \(!otherActivePlan\) \{/);
  assert.match(detail, /Alert\.alert\(/);
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
  // A comment about the older Session API response is unrelated to the old training module.
  // The release compatibility link is a route-only boundary. No V1 service or
  // table imports are allowed in V2; the existing V1 stack owns all legacy data.
  const withoutFullLineComments = source.replace(/^\s*\/\/[^\r\n]*/gm, '')
    .replaceAll('LegacyTrainingLink', 'PreviousTrainingLink')
    .replaceAll("'/tools/training-legacy'", "'/tools/training-previous'");
  assert.doesNotMatch(withoutFullLineComments, /(?<!importedFrom)[Ll]egacy(?!Plan\b)/);
  // Never the bare legacy-service function names (createTrainingPlan, updateTrainingPlan,
  // activateTrainingPlan, ...) — the V2 module always uses its own `*TrainingV2*` names.
  assert.doesNotMatch(source, /\b(createTrainingPlan|updateTrainingPlan|activateTrainingPlan|archiveTrainingPlan|scheduleTrainingPlan|reactivateTrainingPlan)\b/);
  assert.match(source, /method:\s*['"]POST['"]/);
  assert.match(source, /method:\s*['"]PATCH['"]/);
  assert.match(source, /method:\s*['"]PUT['"]/);
  // DELETE is intentionally reachable now, but only for the Grow template "unsave" mutation
  // (a real, idempotent unsave — not a destructive delete of any plan or exercise content).
  assert.match(source, /method:\s*['"]DELETE['"]/);
  assert.match(source, /\/activate/);
  assert.match(source, /\/schedule/);
  assert.match(source, /\/reactivate/);
  assert.match(source, /\/archive/);
  assert.match(source, /\/weekly-goal/);
  assert.match(source, /\/training\/templates/);
  assert.match(source, /\/save/);
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
  // Only the own-plan detail screen links to the editor — Grow content has no edit flow.
  const detail = read('./TrainingV2OwnPlanDetail.jsx');
  assert.match(list, /training-v2-plan-editor/);
  assert.match(detail, /training-v2-plan-editor/);
  assert.match(detail, /planId/);
  assert.doesNotMatch(read('./TrainingV2GrowPlanDetail.jsx'), /training-v2-plan-editor/);
});

test('editor screen guards unsaved changes, deduplicates save and navigates to detail on success', () => {
  const editor = read('./TrainingV2PlanEditorScreen.jsx');
  assert.match(editor, /usePreventRemove/);
  assert.match(editor, /Ungespeicherte Änderungen/);
  assert.match(editor, /disabled=\{saving \|\| finishing\}/);
  assert.match(editor, /router\.replace\(\{\s*pathname:\s*'\/tools\/training-v2-plan-detail'/);
  assert.doesNotMatch(editor, /Aktivieren|Vormerken|Archivieren|Reaktivieren/);
});

test('an edit-mode version conflict uses a real native Alert dialog with the exact two required actions, not a dismissible banner', () => {
  const editor = read('./TrainingV2PlanEditorScreen.jsx');
  // No conditional JSX block rendering draft.draftConflict as a banner/View anymore (the
  // negated draftRestored guard, "!draft.draftConflict ? (", is unrelated and must stay).
  assert.doesNotMatch(editor, /\{draft\.draftConflict\s*\?\s*\(/);
  // A real Alert.alert call, reacting to draft.draftConflict via an effect, with exactly the
  // two required button texts wired to the hook's two decision callbacks.
  assert.match(editor, /useEffect\(\(\) => \{\s*if \(!draft\.draftConflict\) return;\s*Alert\.alert\(/);
  assert.match(editor, /text:\s*'Entwurf behalten',\s*onPress:\s*draft\.keepDraft/);
  assert.match(editor, /text:\s*'Aktuellen Plan laden',\s*onPress:\s*draft\.loadCurrentPlanInstead/);
  // Not cancelable — the user cannot dismiss it without picking an action, so neither the
  // server state nor the draft can end up auto-selected by an accidental back-button tap.
  assert.match(editor, /cancelable:\s*false/);
});

test('editor uses usePreventRemove instead of a manual beforeRemove listener, and its route disables the back-button history menu', () => {
  const editor = read('./TrainingV2PlanEditorScreen.jsx');
  // The manual `navigation.addListener('beforeRemove', ...)` + useFocusEffect flow raced
  // with an interactive iOS swipe-back (native-stack pops the screen natively before the JS
  // listener's preventDefault() can take effect) — usePreventRemove is the react-navigation
  // primitive built specifically to avoid that race for native-stack.
  assert.match(editor, /usePreventRemove\(dirty \|\| saving \|\| finishing,/);
  assert.match(editor, /from '@react-navigation\/native'/);
  assert.doesNotMatch(editor, /addListener\(\s*['"]beforeRemove['"]/);
  assert.doesNotMatch(editor, /useFocusEffect/);

  const route = read('../../../../app/(tabs)/tools/training-v2-plan-editor.jsx');
  // The long-press back-button menu can pop straight to an ancestor screen without going
  // through usePreventRemove's guard, so it is disabled — only for this one route, not
  // globally (the flat V2 tools stack and its shared gestureEnabled config stay untouched).
  assert.match(route, /headerBackButtonMenuEnabled:\s*false/);
});

test('a target set only shows kg and Wiederholungen, with no RIR or rest-seconds field', () => {
  const row = read('../components/TrainingV2TargetSetEditorRow.jsx');
  assert.match(row, />kg</);
  assert.match(row, />Wiederholungen</);
  assert.doesNotMatch(row, /RIR/);
  assert.doesNotMatch(row, /Pause|plannedRestSeconds/);
  assert.doesNotMatch(row, /Wdh\./);
  // A single reps field maps to both ends of the existing {minimum, maximum} contract range,
  // so the API/DB target-set model does not need to change for this.
  assert.match(row, /setField\('targetReps', value === null \? null : \{ minimum: value, maximum: value \}\)/);
  assert.match(row, /targetSet\.targetReps === null \? '' : String\(targetSet\.targetReps\.minimum\)/);
});

test('the session screen guards every way of leaving (header back, hardware back, iOS swipe) through one usePreventRemove, with exactly the three required options and no silent or extra leave path', () => {
  const session = read('./TrainingV2SessionActiveScreen.jsx');
  assert.match(session, /from '@react-navigation\/native'/);
  assert.match(session, /usePreventRemove\(Boolean\(draft\),/);
  // Same reasoning as the plan editor's own usePreventRemove use: a hand-rolled
  // beforeRemove/BackHandler listener races an interactive swipe-back, usePreventRemove does
  // not — so no manual listener may exist alongside it here either.
  assert.doesNotMatch(session, /addListener\(\s*['"]beforeRemove['"]/);
  assert.doesNotMatch(session, /BackHandler/);
  assert.match(session, /text: 'Training fortsetzen', style: 'cancel'/);
  assert.match(session, /text: draft\?\.pendingSave \? 'Speichern erneut versuchen' : 'Unvollständig speichern'/);
  assert.match(session, /text:\s*\n?\s*'Training verwerfen'/);
  assert.match(session, /navigation\.dispatch\(data\.action\)/);
  // No second, differently-worded discard path that could leave without going through the
  // three-option guard above (this screen used to have its own separate "Verwerfen" link).
  assert.doesNotMatch(session, /discardLink/);
  assert.doesNotMatch(session, /confirmDiscard/);
  assert.doesNotMatch(session, /'Training verwerfen\?'/);
});

test('the leave-guard arms as soon as a session draft exists, independent of hasSessionProgress — an untouched draft is not exempt, and stays armed through an in-flight save', () => {
  const session = read('./TrainingV2SessionActiveScreen.jsx');
  const guardLine = session.slice(session.indexOf('usePreventRemove('), session.indexOf('usePreventRemove(') + 40);
  // hasSessionProgress must play no part in whether the guard is armed. It is still used
  // elsewhere on this screen (to decide whether the "Unvollständig beenden" shortcut button is
  // shown), so a blanket doesNotMatch on the whole file would be wrong — scoped to the guard's
  // own condition instead.
  assert.doesNotMatch(guardLine, /hasSessionProgress/);
  assert.match(guardLine, /usePreventRemove\(Boolean\(draft\), \(/);
  // `saving` must not be part of the boolean passed to usePreventRemove — gating the guard
  // itself on `!saving` used to disarm it for the whole duration of an in-flight save (a real
  // network round-trip), letting a concurrent hardware-back/swipe/header-tap leave silently,
  // unconfirmed, and race finishSave's own post-save navigation. `saving` is checked inside the
  // callback body instead (see the next test), which blocks a second leave attempt without ever
  // turning the guard itself off.
  assert.doesNotMatch(guardLine, /!saving/);
});

test('a leave attempt while a save is already in flight is blocked silently (no second dialog, no unconfirmed exit) — only finishSave\'s own bypass ref lets its post-save navigation through', () => {
  const session = read('./TrainingV2SessionActiveScreen.jsx');
  const guardBody = session.slice(session.indexOf('usePreventRemove(Boolean(draft),'), session.indexOf("Alert.alert(\n      'Training verlassen?'"));
  assert.match(guardBody, /if \(bypassLeaveGuardRef\.current\) \{/);
  assert.match(guardBody, /navigation\.dispatch\(data\.action\)/);
  assert.match(guardBody, /if \(saving\) return;/);
  // The saving-check must come after the bypass check, and before Alert.alert — a concurrent
  // leave attempt during an in-flight save must never reach the dialog.
  const bypassIndex = guardBody.indexOf('bypassLeaveGuardRef.current');
  const savingIndex = guardBody.indexOf('if (saving) return;');
  assert.ok(bypassIndex >= 0 && bypassIndex < savingIndex, 'bypass check must be evaluated before the saving check');

  // finishSave is the only place the bypass ref is ever set, and it does so immediately before
  // its own router.back() — never before save() resolves successfully.
  const finishSave = session.slice(session.indexOf('const finishSave'), session.indexOf('const { completedSets, totalSets }'));
  assert.match(finishSave, /if \(outcome\.ok\) \{\s*bypassLeaveGuardRef\.current = true;\s*router\.back\(\);\s*\}/);
  assert.equal((session.match(/bypassLeaveGuardRef\.current = true/g) ?? []).length, 1, 'the bypass ref is set from exactly one place');
});

test('the guard\'s three options are wired to the correct effect: "Training verwerfen" discards (clears the persisted draft), "Unvollständig speichern" saves, "Training fortsetzen" does neither', () => {
  const session = read('./TrainingV2SessionActiveScreen.jsx');
  const discardBlock = session.slice(session.indexOf("'Training verwerfen'"), session.indexOf("'Training verwerfen'") + 200);
  assert.match(discardBlock, /await discard\(\);/);
  assert.match(discardBlock, /navigation\.dispatch\(data\.action\)/);
  const saveBlock = session.slice(session.indexOf("'Unvollständig speichern'"), session.indexOf("'Unvollständig speichern'") + 250);
  assert.match(saveBlock, /await save\('incomplete'\)/);
  // "Training fortsetzen" is the plain cancel entry with no onPress at all — selecting it must
  // neither discard nor save, it just closes the dialog and leaves the draft untouched.
  assert.match(session, /\{ text: 'Training fortsetzen', style: 'cancel' \},/);
});

test('"Mein Training" retains resume-first default selection and separates every explicit unit choice from starting', () => {
  const myTraining = read('./TrainingV2MyTrainingScreen.jsx');
  // resolveTargetUnit: a resumable draft short-circuits before nextUnit is ever consulted.
  const resolveBody = myTraining.slice(
    myTraining.indexOf('function resolveTargetUnit'),
    myTraining.indexOf('export default function TrainingV2MyTrainingScreen'),
  );
  assert.match(resolveBody, /if \(resumableUnitId\) \{/);
  assert.match(resolveBody, /resuming: true/);
  const nextUnitIndex = resolveBody.indexOf('plan.nextUnit');
  const resumableIndex = resolveBody.indexOf('if (resumableUnitId)');
  assert.ok(resumableIndex < nextUnitIndex, 'the resumable-draft branch must be checked, and returned from, before plan.nextUnit is ever read');

  // findTrainingV2SessionDraftForPlan is only ever used to look up resumableUnitId — never
  // recomputed as an alternative unit source or bypassed by a fresh unit selection.
  assert.match(myTraining, /findTrainingV2SessionDraftForPlan/);
  assert.match(myTraining, /setResumableUnitId\(resumable\?\.planId === activePlan\?\.id \? resumable\.unitId : null\)/);
  assert.match(myTraining, /Gespeicherten Trainingsentwurf fortsetzen/);

  // All units remain visible; selection is local and only the explicit CTA starts.
  assert.match(myTraining, /plan\.units\.length > 0/);
  assert.match(myTraining, /setSelection\(\{ scope: selectionScope, unitId: unit\.id \}\)/);
  assert.match(myTraining, /onPress=\{startSelectedUnit\}/);
  assert.doesNotMatch(myTraining, /onPress=\{\(\) => openSession\(unit\.id\)\}/);
});

test('"Mein Training" defaults only to supported strength units and disables starts for visible unsupported selections', () => {
  const myTraining = read('./TrainingV2MyTrainingScreen.jsx');
  const resolveBody = myTraining.slice(
    myTraining.indexOf('function resolveTargetUnit'),
    myTraining.indexOf('export default function TrainingV2MyTrainingScreen'),
  );
  // strengthUnits is derived first and is the only pool resolveTargetUnit ever picks from —
  // both the resumable match and the plan.nextUnit lookup search within it, never plan.units
  // directly, so a rest/run/mobility/stretching unit id can never come out of this function.
  const strengthUnitsIndex = resolveBody.indexOf("plan.units.filter((unit) => unit.unitType === 'strength')");
  assert.ok(strengthUnitsIndex >= 0, 'resolveTargetUnit must derive its candidate pool from strength units only');
  assert.match(resolveBody, /strengthUnits\.find\(\(unit\) => unit\.id === resumableUnitId\)/);
  assert.match(resolveBody, /strengthUnits\.length === 0/);

  assert.match(resolveBody, /strengthUnits\.find\(\(unit\) => unit\.id === plan\.nextUnit\?\.id\)/);
  assert.match(myTraining, /targetUnit\.unitType !== 'strength'/);
  assert.match(myTraining, /disabled=\{startDisabled\}/);
  assert.match(myTraining, /Trainingseinheit auswählen/);
});

test('the session screen has exactly one "Notiz zur Übung" field per exercise, wired to updateNote(exerciseIndex, ...) — never the read-only "Letzte Notiz" hint, and never one of the per-set "Notiz zum Satz" inputs', () => {
  const session = read('./TrainingV2SessionActiveScreen.jsx');
  assert.match(session, /accessibilityLabel="Notiz zur Übung"/);
  assert.match(session, /onChangeText=\{\(text\) => updateNote\(exerciseIndex, text\)\}/);
  assert.match(session, /value=\{exercise\.note \?\? ''\}/);

  // The exercise note field sits inside the exercise card, before any per-set row, and reads
  // from exercise.note — never from lastNotes (the "Letzte Notiz" hint is never copied into
  // today's editable field, matching useLastExerciseNotes' own contract).
  const cardStart = session.indexOf('draft.exercises.map((exercise, exerciseIndex) =>');
  const noteFieldIndex = session.indexOf('accessibilityLabel="Notiz zur Übung"');
  const firstSetRowIndex = session.indexOf('exercise.sets.map((set, setIndex) =>');
  assert.ok(cardStart >= 0 && cardStart < noteFieldIndex && noteFieldIndex < firstSetRowIndex);
  const noteFieldBlock = session.slice(noteFieldIndex - 20, noteFieldIndex + 400);
  assert.doesNotMatch(noteFieldBlock, /lastNotes\[/);

  // updateNote must come from the session hook alongside updateInput, not be a locally
  // reinvented setter.
  assert.match(session, /updateInput, updateNote, completeSet, uncompleteSet,/);

  // Exactly one visible note field per exercise means exactly one "Notiz..." TextInput in the
  // whole screen source per rendered exercise card — i.e. no second, per-set note field sits
  // alongside it. SessionSetRow (the per-set row component) is the only other place a note
  // input could hide, so its own body is asserted empty of one below.
  assert.equal((session.match(/accessibilityLabel="Notiz[^"]*"/g) ?? []).length, 1);
});

test('SessionSetRow renders no note input at all — the per-set "Notiz zum Satz" field has been fully removed from the mobile UI, not just hidden', () => {
  const session = read('./TrainingV2SessionActiveScreen.jsx');
  assert.doesNotMatch(session, /Notiz zum Satz/);
  assert.doesNotMatch(session, /Satznotiz/);

  const setRowStart = session.indexOf('function SessionSetRow');
  const setRowEnd = session.indexOf('export default function TrainingV2SessionActiveScreen');
  const setRowBody = session.slice(setRowStart, setRowEnd);
  assert.ok(setRowStart >= 0 && setRowEnd > setRowStart);
  assert.equal((setRowBody.match(/<TextInput/g) ?? []).length, 2, 'only the kg and Wiederholungen inputs remain in the per-set row');
  assert.doesNotMatch(setRowBody, /accessibilityLabel="Notiz/);
  assert.doesNotMatch(setRowBody, /updateInput\(exerciseIndex, setIndex, \{ note:/);
});
