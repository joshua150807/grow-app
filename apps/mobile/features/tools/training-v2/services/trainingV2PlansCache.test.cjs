const assert = require('node:assert/strict');
const test = require('node:test');

const { loadModule } = require('../testing/loadModule.cjs');

function loadCache() {
  let authHandler;
  const cache = loadModule(__dirname, './trainingV2PlansCache.js', {
    '../../../../services/supabaseClient': {
      supabase: {
        auth: {
          onAuthStateChange: (handler) => {
            authHandler = handler;
            return { data: { subscription: { unsubscribe() {} } } };
          },
        },
      },
    },
  });
  return { ...cache, emitAuthEvent: (event, session) => authHandler(event, session) };
}

test('no owner and no cache before any auth event has ever fired', () => {
  const cache = loadCache();
  assert.equal(cache.getTrainingV2PlansOwnerId(), null);
  assert.equal(cache.getCachedTrainingV2Plans('user-a'), null);
});

test('a signed-in user only ever reads back their own cached plans', () => {
  const cache = loadCache();
  cache.emitAuthEvent('SIGNED_IN', { user: { id: 'user-a' } });
  assert.equal(cache.getTrainingV2PlansOwnerId(), 'user-a');
  assert.equal(cache.getCachedTrainingV2Plans('user-a'), null);

  cache.setCachedTrainingV2Plans('user-a', [{ id: 'plan-a' }]);
  assert.deepEqual(cache.getCachedTrainingV2Plans('user-a'), [{ id: 'plan-a' }]);
});

test('switching to a different signed-in user drops the previous owner\'s cache entry', () => {
  const cache = loadCache();
  cache.emitAuthEvent('SIGNED_IN', { user: { id: 'user-a' } });
  cache.setCachedTrainingV2Plans('user-a', [{ id: 'plan-a' }]);

  cache.emitAuthEvent('SIGNED_IN', { user: { id: 'user-b' } });

  assert.equal(cache.getTrainingV2PlansOwnerId(), 'user-b');
  assert.equal(cache.getCachedTrainingV2Plans('user-b'), null, 'user B must never see user A\'s cached plans');
  assert.equal(cache.getCachedTrainingV2Plans('user-a'), null, 'user A\'s entry must not survive once they are no longer signed in');
});

test('signing out clears the owner id and the entire cache, so no stale data survives a future login', () => {
  const cache = loadCache();
  cache.emitAuthEvent('SIGNED_IN', { user: { id: 'user-a' } });
  cache.setCachedTrainingV2Plans('user-a', [{ id: 'plan-a' }]);

  cache.emitAuthEvent('SIGNED_OUT', null);

  assert.equal(cache.getTrainingV2PlansOwnerId(), null);
  assert.equal(cache.getCachedTrainingV2Plans('user-a'), null);
  assert.equal(cache.getCachedTrainingV2Plans(null), null);
});

test('reads and writes with no user id (logged out) never touch or return any cached entry', () => {
  const cache = loadCache();
  cache.emitAuthEvent('SIGNED_IN', { user: { id: 'user-a' } });
  cache.setCachedTrainingV2Plans(null, [{ id: 'leaked' }]);
  assert.equal(cache.getCachedTrainingV2Plans(null), null);
  assert.equal(cache.getCachedTrainingV2Plans('user-a'), null);
});
