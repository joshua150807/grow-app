const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const repositoryRoot = path.resolve(__dirname, '../../../../../..');

// Validates the exact payload shapes trainingV2Api.js builds for the plan-action
// mutations against the *real* Zod schemas in packages/shared/src (never dist),
// matching the runtime-proof pattern already used for the editor's create/edit payloads.
function safeParseWithRealSchema(schemaExportName, payload) {
  const script = `
    import { ${schemaExportName} } from './packages/shared/src/index.ts';
    const payload = ${JSON.stringify(payload)};
    const result = ${schemaExportName}.safeParse(payload);
    process.stdout.write(JSON.stringify({
      success: result.success,
      issuePaths: result.success ? [] : result.error.issues.map((issue) => issue.path.join('.')),
    }));
  `;
  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', '--input-type=module', '-e', script],
    { cwd: repositoryRoot, encoding: 'utf8' },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

test('activate/reactivate/archive payloads satisfy the real planVersionInputSchema', () => {
  const outcome = safeParseWithRealSchema('planVersionInputSchema', { expectedVersion: 3 });
  assert.equal(outcome.success, true, JSON.stringify(outcome.issuePaths));
});

test('planVersionInputSchema rejects an extra field (no accidental over-posting)', () => {
  const outcome = safeParseWithRealSchema('planVersionInputSchema', { expectedVersion: 3, status: 'active' });
  assert.equal(outcome.success, false);
});

test('the schedule payload (local date + IANA zone, no UTC instant) satisfies the real scheduleTrainingPlanInputSchema', () => {
  const outcome = safeParseWithRealSchema('scheduleTrainingPlanInputSchema', {
    expectedVersion: 3, startDate: '2026-08-01', timeZone: 'Europe/Berlin',
  });
  assert.equal(outcome.success, true, JSON.stringify(outcome.issuePaths));
});

test('scheduleTrainingPlanInputSchema rejects a client-computed effectiveAt/UTC instant field', () => {
  const outcome = safeParseWithRealSchema('scheduleTrainingPlanInputSchema', {
    expectedVersion: 3, startDate: '2026-08-01', timeZone: 'Europe/Berlin', effectiveAt: '2026-08-01T00:00:00.000Z',
  });
  assert.equal(outcome.success, false);
});

test('scheduleTrainingPlanInputSchema rejects a non-local-date string', () => {
  const outcome = safeParseWithRealSchema('scheduleTrainingPlanInputSchema', {
    expectedVersion: 3, startDate: '2026-08-01T00:00:00.000Z', timeZone: 'Europe/Berlin',
  });
  assert.equal(outcome.success, false);
});

test('the weekly-goal payload satisfies the real updateWeeklyGoalInputSchema', () => {
  const outcome = safeParseWithRealSchema('updateWeeklyGoalInputSchema', { expectedVersion: 3, weeklyGoal: 4 });
  assert.equal(outcome.success, true, JSON.stringify(outcome.issuePaths));
});

test('updateWeeklyGoalInputSchema rejects a non-positive or non-integer goal', () => {
  const zero = safeParseWithRealSchema('updateWeeklyGoalInputSchema', { expectedVersion: 3, weeklyGoal: 0 });
  const fractional = safeParseWithRealSchema('updateWeeklyGoalInputSchema', { expectedVersion: 3, weeklyGoal: 2.5 });
  assert.equal(zero.success, false);
  assert.equal(fractional.success, false);
});
