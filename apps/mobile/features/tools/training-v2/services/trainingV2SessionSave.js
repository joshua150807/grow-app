import { buildTrainingV2SessionPayload } from '../models/trainingV2SessionModel';
import { createTrainingV2Session } from './trainingV2Api';

// A thin, stateless wrapper: builds the exact same payload every time from whatever the draft
// currently holds (same idempotencyKey, same completedAt timestamps — nothing is regenerated
// per attempt), so calling this again after a TrainingV2NetworkError is a safe, byte-identical
// retry rather than a new request. The caller decides what to do with a failure (keep the
// draft, show a message) — this never mutates or clears anything itself.
export async function saveTrainingV2Session(state, status, { createSession = createTrainingV2Session } = {}) {
  const payload = buildTrainingV2SessionPayload(state, status);
  try {
    const result = await createSession(payload);
    return { ok: true, session: result.session, created: result.created };
  } catch (error) {
    return { ok: false, error };
  }
}
