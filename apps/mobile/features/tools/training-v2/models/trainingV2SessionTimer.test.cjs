const assert = require('node:assert/strict');
const test = require('node:test');

const {
  adjustRestTimerEndsAt,
  elapsedRestSeconds,
  formatRestTimer,
  isRestTimerFinished,
  remainingRestSeconds,
  startRestTimerEndsAt,
} = require('../testing/loadModule.cjs').loadModule(__dirname, './trainingV2SessionTimer.js');

test('startRestTimerEndsAt adds the planned duration to an absolute now, in ms', () => {
  assert.equal(startRestTimerEndsAt(1_000, 120), 1_000 + 120_000);
  assert.equal(startRestTimerEndsAt(0, 0), 0);
});

test('adjustRestTimerEndsAt shifts by +-30s but never lets the remaining time go below the floor of now', () => {
  const now = 10_000;
  assert.equal(adjustRestTimerEndsAt(now + 60_000, 30, now), now + 90_000);
  assert.equal(adjustRestTimerEndsAt(now + 60_000, -30, now), now + 30_000);
  // Subtracting past "now" clamps at "now" (0 remaining) instead of going negative.
  assert.equal(adjustRestTimerEndsAt(now + 10_000, -30, now), now);
  assert.equal(adjustRestTimerEndsAt(now - 5_000, -30, now), now);
});

test('remainingRestSeconds rounds up to the next whole second and floors at zero', () => {
  const now = 0;
  assert.equal(remainingRestSeconds(now + 1, now), 1);
  assert.equal(remainingRestSeconds(now + 1_000, now), 1);
  assert.equal(remainingRestSeconds(now + 1_001, now), 2);
  assert.equal(remainingRestSeconds(now, now), 0);
  assert.equal(remainingRestSeconds(now - 5_000, now), 0);
});

test('isRestTimerFinished is exactly remainingRestSeconds === 0', () => {
  const now = 5_000;
  assert.equal(isRestTimerFinished(now + 500, now), false);
  assert.equal(isRestTimerFinished(now, now), true);
  assert.equal(isRestTimerFinished(now - 500, now), true);
});

test('elapsedRestSeconds measures from the set\'s completedAt to the dismiss time and floors at zero', () => {
  const completedAt = '2026-08-01T10:00:00.000Z';
  const dismissedAt = new Date('2026-08-01T10:02:05.000Z').getTime();
  assert.equal(elapsedRestSeconds(completedAt, dismissedAt), 125);
  // A dismiss timestamp before completedAt (clock skew) never produces a negative duration.
  assert.equal(elapsedRestSeconds(completedAt, new Date('2026-08-01T09:59:00.000Z').getTime()), 0);
});

test('formatRestTimer renders M:SS with a zero-padded seconds component', () => {
  assert.equal(formatRestTimer(0), '0:00');
  assert.equal(formatRestTimer(5), '0:05');
  assert.equal(formatRestTimer(65), '1:05');
  assert.equal(formatRestTimer(600), '10:00');
});
