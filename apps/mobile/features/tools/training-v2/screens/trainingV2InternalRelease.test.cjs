const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { loadJsxModule } = require('../testing/loadJsxModule.cjs');
const read = p => fs.readFileSync(path.resolve(__dirname, p), 'utf8');
function nodes(tree) { return !tree || typeof tree !== 'object' ? [] : [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)]; }
for (const initialLoading of [false, true]) test('V1 access remains usable when V2 loading=' + initialLoading, () => {
  const pushes = [];
  const screen = loadJsxModule(__dirname, './TrainingV2HubScreen.jsx', {
    'react-native': Object.fromEntries(['Image', 'Pressable', 'RefreshControl', 'ScrollView', 'Text', 'View'].map(n => [n, n])),
    'expo-router': { router: { push: p => pushes.push(p) } },
    '../../../../constants/colors': { COLORS: {} },
    '../../../../constants/toolAssets': { TRAINING_V2_HUB_ICONS: {} },
    '../components/TrainingV2StateView': { TrainingV2StateView: () => null },
    '../hooks/useTrainingV2Plans': { useTrainingV2Plans: () => ({ plans: [], initialLoading }) },
    '../styles/trainingV2Styles': { styles: {} },
  }).default;
  const link = nodes(screen()).find(n => typeof n.type === 'function' && n.type.name === 'LegacyTrainingLink');
  assert.ok(link, 'legacy access must not depend on successful V2 requests');
  link.type().props.onPress();
  assert.deepEqual(pushes, ['/tools/training-legacy']);
});
test('compatibility route reuses V1 flow and performs no import or copying', () => {
  const source = read('../../../../app/(tabs)/tools/(training)/training-legacy.jsx');
  assert.match(source, /export \{ default \} from .*training\/screens\/TrainingOverviewScreen/);
  assert.doesNotMatch(source, /insert|upsert|fetch\(/);
});
test('new internal profile preserves beta, app identity and isolates both OTA channel and runtime', () => {
  const eas = JSON.parse(read('../../../../eas.json'));
  const app = JSON.parse(read('../../../../app.json')).expo;
  assert.equal(eas.build.beta.channel, 'beta');
  assert.equal(eas.build.beta.environment, 'production');
  const profile = eas.build['training-v2-internal'];
  assert.equal(profile.extends, 'beta');
  assert.equal(profile.distribution, 'store');
  assert.equal(profile.environment, 'production');
  assert.equal(profile.env.EXPO_PUBLIC_TRAINING_V2_ENABLED, 'true');
  assert.equal(profile.channel, 'training-v2-internal');
  assert.equal(app.ios.bundleIdentifier, 'app.joingrow.grow');
  assert.equal(app.extra.eas.projectId, '8c1e8833-6b65-4b94-9720-956f8564da1d');
  // Runtime follows the app version (policy appVersion): the internal build ships
  // a newer version than Build 42 (1.0.8), so OTA runtimes never overlap. No
  // dynamic app.config.js: it made local and EAS runtime calculation diverge.
  assert.deepEqual(app.runtimeVersion, { policy: 'appVersion' });
  assert.notEqual(app.version, '1.0.8');
  assert.equal(fs.existsSync(path.resolve(__dirname, '../../../../app.config.js')), false);
});
