const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { transformFileSync } = require('@babel/core');
const transformModulesCommonJs = require('@babel/plugin-transform-modules-commonjs');

function loadNormalizers() {
  const filename = path.resolve(__dirname, 'mentorNormalizers.js');
  const code = transformFileSync(filename, {
    babelrc: false,
    configFile: false,
    plugins: [transformModulesCommonJs],
  }).code;
  const module = { exports: {} };
  new Function('module', 'exports', 'require', code)(module, module.exports, require);
  return module.exports;
}

const n = loadNormalizers();

test('settings default to no consent and safe toggles', () => {
  assert.deepEqual(n.normalizeMentorSettings({ settings: {} }), {
    hasConsent: false,
    consentRequiredVersion: 'v1',
    consentedAt: null,
    memoryEnabled: true,
    journalAccessEnabled: false,
    notesAccessEnabled: false,
  });
  assert.equal(n.normalizeMentorSettings({ settings: { has_consent: true } }).hasConsent, true);
  assert.equal(n.normalizeMentorSettings({ settings: { has_consent: 'true' } }).hasConsent, false);
});

test('conversation list drops invalid rows and falls back to a title', () => {
  const result = n.normalizeMentorConversationList({
    conversations: [{ id: 'a', title: '  ' }, null, { title: 'no id' }],
    page: 0,
    has_more: true,
  });
  assert.equal(result.conversations.length, 1);
  assert.equal(result.conversations[0].title, 'Neuer Chat');
  assert.equal(result.hasMore, true);
});

test('messages only accept user and assistant roles', () => {
  const page = n.normalizeMentorMessagePage({
    conversation: { id: 'c', title: 'T' },
    messages: [
      { id: '1', role: 'user', content: 'hi' },
      { id: '2', role: 'system', content: 'secret' },
      { id: '3', role: 'assistant', content: 'hallo' },
    ],
  });
  assert.deepEqual(page.messages.map((m) => m.id), ['1', '3']);
});

test('send result requires conversation and both messages', () => {
  const ok = n.normalizeMentorSendResult({
    conversation: { id: 'c', title: 'T' },
    user_message: { id: '1', role: 'user', content: 'a' },
    assistant_message: { id: '2', role: 'assistant', content: 'b' },
    safety: { crisis_resources_shown: true },
    usage: { used: 2, limit: 30, remaining: 28, resets_at: '2026-11-27T23:00:00.000Z' },
  });
  assert.equal(ok.crisisResourcesShown, true);
  assert.equal(ok.usage.remaining, 28);
  assert.throws(() => n.normalizeMentorSendResult({ conversation: { id: 'c' } }), (error) => (
    error.code === 'MENTOR_API_INVALID_RESPONSE'
  ));
});

test('usage clamps negative values', () => {
  assert.deepEqual(n.normalizeMentorUsage({ usage: { used: -1, limit: 30, remaining: -5 } }), {
    used: 0,
    limit: 30,
    remaining: 0,
    resetsAt: null,
  });
});

test('error messages are German and cover limit reset time', () => {
  assert.match(n.getMentorErrorMessage('MENTOR_DAILY_LIMIT_REACHED'), /Tageslimit/);
  assert.match(
    n.getMentorErrorMessage('MENTOR_DAILY_LIMIT_REACHED', { resetsAt: new Date(2026, 10, 28, 0, 0).toISOString() }),
    /Ab 00:00 Uhr/,
  );
  assert.match(n.getMentorErrorMessage('MENTOR_PROVIDER_TIMEOUT'), /zu lange/);
  assert.match(n.getMentorErrorMessage('SOMETHING_NEW'), /schiefgelaufen/);
});
