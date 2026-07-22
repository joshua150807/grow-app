const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { transformFileSync } = require('@babel/core');
const transformModulesCommonJs = require('@babel/plugin-transform-modules-commonjs');

const profileDir = __dirname;

function loadProfileEdit() {
  const filename = path.join(profileDir, 'profileEdit.js');
  const transformed = transformFileSync(filename, {
    babelrc: false,
    configFile: false,
    filename,
    plugins: [transformModulesCommonJs],
  }).code;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', '__filename', '__dirname', transformed)(
    require,
    module,
    module.exports,
    filename,
    profileDir,
  );
  return module.exports;
}

const edit = loadProfileEdit();

test('keeps an existing bio and uses the central motto only for empty values', () => {
  assert.equal(edit.getVisibleProfileBio('Meine eigene Bio'), 'Meine eigene Bio');
  assert.equal(edit.getVisibleProfileBio(''), edit.PROFILE_MOTTO);
  assert.equal(edit.getVisibleProfileBio('   '), edit.PROFILE_MOTTO);
});

test('prefills the edit draft with the existing bio or central motto', () => {
  assert.deepEqual(
    edit.createProfileEditDraft('grower', 'Eigene Bio'),
    { username: 'grower', bio: 'Eigene Bio' },
  );
  assert.deepEqual(
    edit.createProfileEditDraft('grower', ''),
    { username: 'grower', bio: edit.PROFILE_MOTTO },
  );
});

test('does not persist the motto unless an explicit change payload is built', () => {
  assert.deepEqual(
    edit.buildProfileChanges({
      usernameDraft: 'grower',
      bioDraft: '',
      username: 'grower',
      bio: '',
    }),
    {},
  );
  assert.deepEqual(
    edit.buildProfileChanges({
      usernameDraft: 'grower',
      bioDraft: edit.PROFILE_MOTTO,
      username: 'grower',
      bio: '',
    }),
    { bio: edit.PROFILE_MOTTO },
  );
});

test('an explicitly emptied custom bio is saved empty and falls back visibly to the motto', () => {
  assert.deepEqual(
    edit.buildProfileChanges({
      usernameDraft: 'grower',
      bioDraft: '  ',
      username: 'grower',
      bio: 'Eigene Bio',
    }),
    { bio: '' },
  );
  assert.equal(edit.getVisibleProfileBio(''), edit.PROFILE_MOTTO);
});

test('matches the backend username and bio validation boundaries', () => {
  assert.equal(edit.validateProfileUsername('ab'), 'Mindestens 3 Zeichen.');
  assert.equal(edit.validateProfileUsername('a'.repeat(31)), 'Maximal 30 Zeichen.');
  assert.equal(edit.validateProfileUsername('bad name'), 'Nur Buchstaben, Zahlen und Unterstrich.');
  assert.equal(edit.validateProfileUsername(' Grower_1 '), '');
  assert.equal(edit.validateProfileBio('a'.repeat(100)), '');
  assert.equal(edit.validateProfileBio('a'.repeat(101)), 'Maximal 100 Zeichen.');
});

test('profile screen applies confirmed PATCH before closing and keeps reload best effort', () => {
  const source = fs.readFileSync(path.join(profileDir, 'screens', 'ProfileScreen.jsx'), 'utf8');
  assert.match(source, /profileSaveInProgressRef\.current\) return;/);
  assert.match(source, /const confirmedProfile = await updateMyProfileV1\(changes\)/);
  assert.match(source, /applyConfirmedProfileResponse\(confirmedProfile, applyProfile, reloadProfile\)/);
  assert.match(source, /setEditVisible\(false\)/);
  assert.match(source, /setProfileSaveError\(getProfileSaveErrorMessage\(error\)\)/);
  assert.doesNotMatch(source, /await reloadProfile\?\.\(\)/);
  assert.match(source, /if \(isSavingProfile\) return;/);
});

test('avatar flow retains camera, gallery, upload, confirm, reset and failure handling', () => {
  const source = fs.readFileSync(path.join(profileDir, 'hooks', 'useProfileAvatar.js'), 'utf8');
  assert.match(source, /runImagePicker\('camera'\)/);
  assert.match(source, /runImagePicker\('library'\)/);
  assert.match(source, /uploadToSignedUrl/);
  assert.match(source, /confirmMyAvatarUploadV1/);
  assert.match(source, /applyConfirmedProfileResponse\(confirmedProfile, applyProfile, reloadProfile\)/);
  assert.match(source, /deleteMyAvatarV1/);
  assert.match(source, /Profilbild nicht aktualisiert/);
  assert.match(source, /Profilbild nicht zurückgesetzt/);
});
