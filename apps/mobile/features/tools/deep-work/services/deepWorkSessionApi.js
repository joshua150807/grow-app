import { ProfileApiError, requestProfileV1 } from '../../../profile/services/profiles';

const REQUEST_TIMEOUT_MS = 15_000;

export async function postDeepWorkSession(
  entry,
  { timeoutMs = REQUEST_TIMEOUT_MS, setTimeoutFn = setTimeout, clearTimeoutFn = clearTimeout } = {}
) {
  const controller = new AbortController();
  let didTimeout = false;
  const timeout = setTimeoutFn(() => {
    didTimeout = true;
    controller.abort();
  }, timeoutMs);

  try {
    return await requestProfileV1(
      '/v1/profile/me/deep-work/sessions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_session_id: entry.clientSessionId,
          duration_seconds: entry.durationSeconds,
          completed_at: entry.completedAt,
        }),
        signal: controller.signal,
      },
      (payload) => payload,
    );
  } catch (error) {
    if (didTimeout) {
      throw new ProfileApiError('Deep Work sync request timed out.', {
        code: 'DEEP_WORK_SYNC_TIMEOUT',
      });
    }
    throw error;
  } finally {
    clearTimeoutFn(timeout);
  }
}
