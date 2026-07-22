const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const settingsSource = fs.readFileSync(path.resolve(__dirname, 'ProfileSettingsScreen.jsx'), 'utf8');
const profileSource = fs.readFileSync(path.resolve(__dirname, 'ProfileScreen.jsx'), 'utf8');
const canvasSource = fs.readFileSync(path.resolve(__dirname, '../components/ProfilePremiumCanvas.jsx'), 'utf8');
const toolsSource = fs.readFileSync(path.resolve(__dirname, '../../tools/overview/screens/ToolsOverviewScreen.jsx'), 'utf8');

test('settings button opens the root profile settings route', () => {
  assert.match(profileSource, /onSettingsPress=\{\(\) => router\.push\('\/profile-settings'\)\}/);
  assert.match(canvasSource, /onPress=\{onSettingsPress\} disabled=\{!onSettingsPress\}/);
});

test('settings reuses existing privacy and imprint routes', () => {
  assert.match(settingsSource, /router\.push\('\/\(tabs\)\/tools\/privacy'\)/);
  assert.match(settingsSource, /router\.push\('\/\(tabs\)\/tools\/imprint'\)/);
});

test('settings directly uses startTutorial without touching onboarding storage', () => {
  assert.match(settingsSource, /const \{ startTutorial \} = useOnboarding\(\)/);
  assert.match(settingsSource, /onPress=\{\(\) => startTutorial\(\)\}/);
  assert.doesNotMatch(settingsSource, /AsyncStorage|resetOnboarding|multiRemove|removeItem/);
});

test('tools overview and profile settings use the shared logout service', () => {
  assert.match(settingsSource, /logoutCurrentUser/);
  assert.match(toolsSource, /logoutCurrentUser/);
  assert.doesNotMatch(toolsSource, /supabase\.auth\.signOut/);
});

test('settings clears password fields only after successful change and keeps errors controlled', () => {
  assert.match(settingsSource, /await changeCurrentUserPassword\(passwords\);\s+setPasswords\(EMPTY_PASSWORDS\)/);
  assert.match(settingsSource, /catch \(error\) \{\s+setPasswordError/);
  assert.match(settingsSource, /passwordFlightRef\.current/);
});

test('settings never logs or persists passwords', () => {
  assert.doesNotMatch(settingsSource, /AsyncStorage|console\.|logger\./);
});
