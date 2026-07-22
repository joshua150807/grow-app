import { supabase } from '../../../../services/supabaseClient';
import { postDeepWorkSession } from './deepWorkSessionApi';
import { isDeepWorkSyncEnabled } from './deepWorkSyncConfig';
import {
  getDeepWorkSyncQueue,
  markDeepWorkSyncEntryTerminal,
  removeDeepWorkSyncEntry,
  scheduleDeepWorkSyncEntryRetry,
} from './deepWorkStore';

const BASE_RETRY_MS = 5_000;
const MAX_RETRY_MS = 15 * 60 * 1_000;
const MAX_ENTRIES_PER_RUN = 25;
const syncFlights = new Map();

function safeErrorCode(error) {
  return typeof error?.code === 'string' && error.code.trim()
    ? error.code.trim().slice(0, 100)
    : error?.status
      ? `HTTP_${error.status}`
      : 'UNKNOWN';
}

async function requireCurrentUser(expectedUserId) {
  const { data: { session } = {}, error } = await supabase.auth.getSession();
  const currentUserId = error ? null : session?.user?.id || null;
  if (!currentUserId) {
    const authError = new Error('Deep Work sync requires authentication.');
    authError.code = 'DEEP_WORK_SYNC_AUTH_REQUIRED';
    throw authError;
  }
  if (currentUserId !== expectedUserId) {
    const authError = new Error('Deep Work sync owner changed.');
    authError.code = 'DEEP_WORK_SYNC_AUTH_MISMATCH';
    throw authError;
  }
  return currentUserId;
}

export function calculateDeepWorkRetryDelay(
  attempts,
  { baseMs = BASE_RETRY_MS, maxMs = MAX_RETRY_MS, random = Math.random } = {}
) {
  const exponent = Math.max(Number.isInteger(attempts) ? attempts : 0, 0);
  const withoutJitter = Math.min(baseMs * (2 ** exponent), maxMs);
  const jitter = 0.9 + Math.min(Math.max(Number(random()) || 0, 0), 1) * 0.2;
  return Math.min(Math.round(withoutJitter * jitter), maxMs);
}

export function classifyDeepWorkSyncError(error) {
  const status = Number(error?.status) || null;
  const code = safeErrorCode(error);
  if (status === 401 || code === 'PROFILE_API_SESSION_MISSING' || code === 'PROFILE_API_SESSION_ERROR') {
    return { type: 'auth', code };
  }
  if (
    status === 408
    || status === 429
    || (status >= 500 && status <= 599)
    || code === 'PROFILE_API_NETWORK_ERROR'
    || code === 'DEEP_WORK_SYNC_TIMEOUT'
  ) {
    return { type: 'retry', code };
  }
  if (status >= 400 && status <= 499) return { type: 'terminal', code };
  return { type: 'retry', code };
}

async function runDeepWorkSyncInternal(userId, {
  now = Date.now,
  random = Math.random,
  postSession = postDeepWorkSession,
  maxEntries = MAX_ENTRIES_PER_RUN,
} = {}) {
  await requireCurrentUser(userId);
  const queue = await getDeepWorkSyncQueue(userId);
  let processed = 0;
  const runLimit = Math.min(Math.max(Number(maxEntries) || 0, 0), MAX_ENTRIES_PER_RUN);

  for (const entry of queue.entries) {
    if (processed >= runLimit) break;
    if (entry.status === 'terminal') continue;
    if (entry.nextAttemptAt && new Date(entry.nextAttemptAt).getTime() > now()) continue;

    await requireCurrentUser(userId);
    processed += 1;
    try {
      await postSession(entry);
      await requireCurrentUser(userId);
      await removeDeepWorkSyncEntry(userId, entry.clientSessionId);
    } catch (error) {
      const classification = classifyDeepWorkSyncError(error);
      if (
        classification.type === 'auth'
        || error?.code === 'DEEP_WORK_SYNC_AUTH_REQUIRED'
        || error?.code === 'DEEP_WORK_SYNC_AUTH_MISMATCH'
      ) {
        return { processed, stopped: 'auth' };
      }
      await requireCurrentUser(userId);
      if (classification.type === 'terminal') {
        await markDeepWorkSyncEntryTerminal(userId, entry.clientSessionId, classification.code);
      } else {
        const delay = calculateDeepWorkRetryDelay(entry.attempts, { random });
        await scheduleDeepWorkSyncEntryRetry(userId, entry.clientSessionId, {
          nextAttemptAt: new Date(now() + delay).toISOString(),
          errorCode: classification.code,
        });
      }
    }
  }

  return { processed, stopped: null };
}

export function runDeepWorkSync(userId, options) {
  if (!isDeepWorkSyncEnabled()) return Promise.resolve({ processed: 0, stopped: 'disabled' });
  if (syncFlights.has(userId)) return syncFlights.get(userId);
  const flight = runDeepWorkSyncInternal(userId, options).catch((error) => {
    if (
      error?.code === 'DEEP_WORK_SYNC_AUTH_REQUIRED'
      || error?.code === 'DEEP_WORK_SYNC_AUTH_MISMATCH'
    ) {
      return { processed: 0, stopped: 'auth' };
    }
    throw error;
  });
  syncFlights.set(userId, flight);
  flight.finally(() => {
    if (syncFlights.get(userId) === flight) syncFlights.delete(userId);
  }).catch(() => {});
  return flight;
}

export async function triggerDeepWorkSyncForCurrentUser(options) {
  if (!isDeepWorkSyncEnabled()) return { processed: 0, stopped: 'disabled' };
  const { data: { session } = {}, error } = await supabase.auth.getSession();
  if (error || !session?.user?.id) return { processed: 0, stopped: 'auth' };
  return runDeepWorkSync(session.user.id, options);
}
