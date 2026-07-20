import AsyncStorage from '@react-native-async-storage/async-storage';

import { createDeepWorkClientSessionId } from './deepWorkClientId';
import { isDeepWorkSyncEnabled } from './deepWorkSyncConfig';
import { supabase } from '../../../../services/supabaseClient';

const KEY = '@deep_work_session';
const HISTORY_KEY = '@deep_work_history';
const SYNC_QUEUE_KEY_PREFIX = '@deep_work_sync_v1:';
const LEGACY_OWNER_KEY = '@deep_work_legacy_owner_v1';
const DEEP_WORK_HISTORY_RETENTION_DAYS = 7;
const MAX_HISTORY_ENTRIES = 250;
const ACTIVE_SESSION_SCHEMA_VERSION = 2;
const SYNC_QUEUE_SCHEMA_VERSION = 1;
const LEGACY_OWNER_SCHEMA_VERSION = 1;
const COMPLETION_INTENT_SCHEMA_VERSION = 1;
const MAX_ID_GENERATION_ATTEMPTS = 20;
let legacyClaimFlight = null;
const queueMutationFlights = new Map();

export class DeepWorkSyncStoreError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'DeepWorkSyncStoreError';
    this.code = code;
  }
}

function getSafeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function optionalString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeIsoDate(value) {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

function normalizeCompletionIntent(intent) {
  if (!intent || typeof intent !== 'object' || Array.isArray(intent)) return null;
  const durationSeconds = Math.round(getSafeNumber(intent.durationSeconds));
  const completedAt = normalizeIsoDate(intent.completedAt);
  const reason = ['manual', 'natural', 'restored'].includes(intent.reason)
    ? intent.reason
    : null;
  if (intent.status !== 'pending' || durationSeconds <= 0 || !completedAt || !reason) return null;
  return {
    schemaVersion: COMPLETION_INTENT_SCHEMA_VERSION,
    status: 'pending',
    reason,
    durationSeconds,
    completedAt,
  };
}

function requireOwnerUserId(userId) {
  const normalized = optionalString(userId);
  if (!normalized) {
    throw new DeepWorkSyncStoreError('DEEP_WORK_SYNC_OWNER_REQUIRED', 'A sync queue owner is required.');
  }
  return normalized;
}

function queueKey(userId) {
  return `${SYNC_QUEUE_KEY_PREFIX}${encodeURIComponent(requireOwnerUserId(userId))}`;
}

function normalizeSession(session) {
  if (!session || typeof session !== 'object') return null;

  const phase = session.phase === 'running' || session.phase === 'paused'
    ? session.phase
    : 'paused';
  const remaining = Math.max(getSafeNumber(session.remaining), 0);
  const totalSeconds = Math.max(
    getSafeNumber(session.totalSeconds, remaining),
    remaining
  );
  const updatedAt = getSafeNumber(session.updatedAt, Date.now());
  const endTimestamp = phase === 'running'
    ? getSafeNumber(session.endTimestamp, updatedAt + remaining * 1000)
    : null;
  const ownerUserId = optionalString(session.ownerUserId);
  const clientSessionId = optionalString(session.clientSessionId);
  const startedAt = normalizeIsoDate(session.startedAt);
  const completionTimestamp = normalizeIsoDate(session.completionTimestamp);
  const completionIntent = normalizeCompletionIntent(session.completionIntent);
  const isV2 = Number(session.schemaVersion) >= ACTIVE_SESSION_SCHEMA_VERSION;

  if (remaining <= 0 && totalSeconds <= 0) return null;

  return {
    phase,
    remaining,
    totalSeconds,
    taskName: typeof session.taskName === 'string' && session.taskName.trim()
      ? session.taskName
      : 'Deep Work',
    category: typeof session.category === 'string' && session.category.trim()
      ? session.category
      : 'Fokus',
    updatedAt,
    endTimestamp,
    ...(completionTimestamp ? { completionTimestamp } : {}),
    ...(isV2
      || ownerUserId || clientSessionId || startedAt
      ? { schemaVersion: ACTIVE_SESSION_SCHEMA_VERSION }
      : {}),
    ...(isV2 ? { legacyClaimEligible: session.legacyClaimEligible === true } : {}),
    ...(ownerUserId ? { ownerUserId } : {}),
    ...(clientSessionId ? { clientSessionId } : {}),
    ...(startedAt ? { startedAt } : {}),
    ...(completionIntent ? { completionIntent } : {}),
  };
}

function normalizeHistoryEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;

  const durationSeconds = Math.max(getSafeNumber(entry.durationSeconds), 0);
  const completedAt = normalizeIsoDate(entry.completedAt);

  if (durationSeconds <= 0 || !completedAt) return null;

  const clientSessionId = optionalString(entry.clientSessionId);
  const ownerUserId = optionalString(entry.ownerUserId);
  const id = optionalString(entry.id) || clientSessionId || `${new Date(completedAt).getTime()}`;

  return {
    id,
    ...(clientSessionId ? { clientSessionId } : {}),
    ...(ownerUserId ? { ownerUserId } : {}),
    durationSeconds,
    completedAt,
  };
}

function normalizeQueueEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;

  const clientSessionId = optionalString(entry.clientSessionId);
  const completedAt = normalizeIsoDate(entry.completedAt);
  const durationSeconds = Math.round(getSafeNumber(entry.durationSeconds));
  const status = entry.status === 'terminal' ? 'terminal' : 'pending';

  if (!clientSessionId || clientSessionId.length > 128 || durationSeconds <= 0 || !completedAt) {
    return null;
  }

  return {
    clientSessionId,
    durationSeconds,
    completedAt,
    status,
    attempts: Math.max(Math.floor(getSafeNumber(entry.attempts)), 0),
    nextAttemptAt: normalizeIsoDate(entry.nextAttemptAt),
    lastErrorCode: optionalString(entry.lastErrorCode),
    source: entry.source === 'legacy' ? 'legacy' : 'new',
    ...(optionalString(entry.legacyKey) ? { legacyKey: optionalString(entry.legacyKey) } : {}),
  };
}

function emptyQueue(ownerUserId) {
  return {
    schemaVersion: SYNC_QUEUE_SCHEMA_VERSION,
    ownerUserId,
    legacyImportCompleted: false,
    entries: [],
  };
}

function normalizeQueueDocument(document, expectedOwnerUserId) {
  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    throw new DeepWorkSyncStoreError('DEEP_WORK_SYNC_QUEUE_INVALID', 'The sync queue document is invalid.');
  }

  const ownerUserId = optionalString(document.ownerUserId);
  if (ownerUserId !== expectedOwnerUserId) {
    throw new DeepWorkSyncStoreError('DEEP_WORK_SYNC_OWNER_MISMATCH', 'The sync queue belongs to another user.');
  }

  if (document.schemaVersion !== SYNC_QUEUE_SCHEMA_VERSION || !Array.isArray(document.entries)) {
    throw new DeepWorkSyncStoreError('DEEP_WORK_SYNC_QUEUE_INVALID', 'The sync queue document is invalid.');
  }
  const entries = document.entries.map(normalizeQueueEntry);
  if (entries.some((entry) => !entry)) {
    throw new DeepWorkSyncStoreError('DEEP_WORK_SYNC_QUEUE_INVALID', 'The sync queue document is invalid.');
  }
  const uniqueEntries = [];
  const seen = new Set();
  for (const entry of entries) {
    if (seen.has(entry.clientSessionId)) {
      throw new DeepWorkSyncStoreError('DEEP_WORK_SYNC_QUEUE_INVALID', 'The sync queue document is invalid.');
    }
    seen.add(entry.clientSessionId);
    uniqueEntries.push(entry);
  }

  return {
    schemaVersion: SYNC_QUEUE_SCHEMA_VERSION,
    ownerUserId,
    legacyImportCompleted: document.legacyImportCompleted === true,
    entries: uniqueEntries,
  };
}

async function writeDeepWorkSyncQueue(ownerUserId, document) {
  const normalized = normalizeQueueDocument(document, ownerUserId);
  await AsyncStorage.setItem(queueKey(ownerUserId), JSON.stringify(normalized));
  return normalized;
}

async function runQueueMutation(ownerUserId, mutation) {
  const previous = queueMutationFlights.get(ownerUserId) || Promise.resolve();
  const operation = previous.catch(() => {}).then(mutation);
  queueMutationFlights.set(ownerUserId, operation);
  try {
    return await operation;
  } finally {
    if (queueMutationFlights.get(ownerUserId) === operation) {
      queueMutationFlights.delete(ownerUserId);
    }
  }
}

function normalizeLegacyOwnerMarker(marker) {
  if (!marker || typeof marker !== 'object' || Array.isArray(marker)) return null;
  const ownerUserId = optionalString(marker.ownerUserId);
  const claimedAt = normalizeIsoDate(marker.claimedAt);
  const state = marker.state === 'completed' ? 'completed' : marker.state === 'claiming' ? 'claiming' : null;
  if (!ownerUserId || !claimedAt || !state) return null;
  return {
    schemaVersion: LEGACY_OWNER_SCHEMA_VERSION,
    ownerUserId,
    state,
    claimedAt,
    completedAt: state === 'completed' ? normalizeIsoDate(marker.completedAt) : null,
  };
}

async function readJson(key) {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function readRequiredJson(key, invalidCode, invalidMessage) {
  const raw = await AsyncStorage.getItem(key);
  if (raw === null) return { exists: false, value: null };
  try {
    return { exists: true, value: JSON.parse(raw) };
  } catch {
    throw new DeepWorkSyncStoreError(invalidCode, invalidMessage);
  }
}

function assertSessionOwner(session, expectedUserId) {
  if (!isDeepWorkSyncEnabled()) return;
  const expectedOwnerUserId = optionalString(expectedUserId);
  const actualOwnerUserId = optionalString(session?.ownerUserId);
  if (actualOwnerUserId !== expectedOwnerUserId) {
    throw new DeepWorkSyncStoreError('DEEP_WORK_SESSION_OWNER_MISMATCH', 'The active session belongs to another user.');
  }
}

function completionIntentsEqual(first, second) {
  return first?.schemaVersion === second?.schemaVersion
    && first?.status === second?.status
    && first?.reason === second?.reason
    && first?.durationSeconds === second?.durationSeconds
    && first?.completedAt === second?.completedAt;
}

async function requireAuthenticatedQueueOwner(userId) {
  const requestedUserId = requireOwnerUserId(userId);
  const { data: { session } = {} } = await supabase.auth.getSession();
  const authenticatedUserId = optionalString(session?.user?.id);
  if (!authenticatedUserId) {
    throw new DeepWorkSyncStoreError('DEEP_WORK_SYNC_AUTH_REQUIRED', 'An authenticated user is required.');
  }
  if (authenticatedUserId !== requestedUserId) {
    throw new DeepWorkSyncStoreError('DEEP_WORK_SYNC_AUTH_MISMATCH', 'The sync queue belongs to another user.');
  }
  return requestedUserId;
}

async function writeAuthenticatedDeepWorkSyncQueue(ownerUserId, document) {
  await requireAuthenticatedQueueOwner(ownerUserId);
  return writeDeepWorkSyncQueue(ownerUserId, document);
}

async function writeDeepWorkSession(session, { allowNewCompletionIntent = false } = {}) {
  let normalized = normalizeSession(session);

  if (!normalized) {
    await clearDeepWorkSession();
    return;
  }

  if (isDeepWorkSyncEnabled()) {
    const rawExisting = await AsyncStorage.getItem(KEY);
    if (rawExisting) {
      let existing;
      let parsedExisting;
      try {
        parsedExisting = JSON.parse(rawExisting);
        existing = normalizeSession(parsedExisting);
      } catch {
        throw new DeepWorkSyncStoreError('DEEP_WORK_SESSION_INVALID', 'The active session is invalid.');
      }
      if (existing) {
        const existingOwner = optionalString(existing.ownerUserId);
        const nextOwner = optionalString(normalized.ownerUserId);
        const existingIsV2 = existing.schemaVersion >= ACTIVE_SESSION_SCHEMA_VERSION;
        if ((existingOwner && existingOwner !== nextOwner) || (existingIsV2 && existingOwner !== nextOwner)) {
          throw new DeepWorkSyncStoreError(
            'DEEP_WORK_SESSION_OWNER_MISMATCH',
            'The active session belongs to another user.'
          );
        }
        const sameStableSession = existingOwner === nextOwner
          && optionalString(existing.clientSessionId) === optionalString(normalized.clientSessionId);
        const existingIntent = normalizeCompletionIntent(existing.completionIntent);
        const nextIntent = normalizeCompletionIntent(normalized.completionIntent);
        if (parsedExisting?.completionIntent != null && !existingIntent) {
          throw new DeepWorkSyncStoreError(
            'DEEP_WORK_SESSION_INVALID',
            'The persisted completion intent is invalid.'
          );
        }
        if (sameStableSession && existingIntent) {
          if (session?.completionIntent != null && !nextIntent) {
            throw new DeepWorkSyncStoreError(
              'DEEP_WORK_COMPLETION_INTENT_CONFLICT',
              'The completion intent cannot be changed.'
            );
          }
          if (nextIntent && !completionIntentsEqual(existingIntent, nextIntent)) {
            throw new DeepWorkSyncStoreError(
              'DEEP_WORK_COMPLETION_INTENT_CONFLICT',
              'The completion intent cannot be changed.'
            );
          }
          normalized = { ...normalized, completionIntent: existingIntent };
        } else if (nextIntent && !allowNewCompletionIntent) {
          throw new DeepWorkSyncStoreError(
            'DEEP_WORK_COMPLETION_INTENT_FORBIDDEN',
            'Only finalization may create a completion intent.'
          );
        }
      } else if (normalized.completionIntent && !allowNewCompletionIntent) {
        throw new DeepWorkSyncStoreError(
          'DEEP_WORK_COMPLETION_INTENT_FORBIDDEN',
          'Only finalization may create a completion intent.'
        );
      }
    } else if (normalized.completionIntent && !allowNewCompletionIntent) {
      throw new DeepWorkSyncStoreError(
        'DEEP_WORK_COMPLETION_INTENT_FORBIDDEN',
        'Only finalization may create a completion intent.'
      );
    }
  }

  await AsyncStorage.setItem(KEY, JSON.stringify(normalized));
  return normalized;
}

export async function saveDeepWorkSession(session) {
  return writeDeepWorkSession(session);
}

export async function clearDeepWorkSession(expectedUserId) {
  if (isDeepWorkSyncEnabled()) {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      let session;
      try {
        session = normalizeSession(JSON.parse(raw));
      } catch {
        throw new DeepWorkSyncStoreError('DEEP_WORK_SESSION_INVALID', 'The active session is invalid.');
      }
      if (session) assertSessionOwner(session, expectedUserId);
    }
  }
  await AsyncStorage.removeItem(KEY);
}

export async function getSavedDeepWorkSession(expectedUserId) {
  let session;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;

    session = normalizeSession(JSON.parse(raw));

    if (!session) {
      await clearDeepWorkSession();
      return null;
    }
  } catch {
    try {
      await clearDeepWorkSession();
    } catch {
      // Ignore cleanup failure for unreadable legacy state.
    }
    return null;
  }

  if (isDeepWorkSyncEnabled()) {
    const expectedOwnerUserId = optionalString(expectedUserId);
    const ownerUserId = optionalString(session.ownerUserId);
    if (ownerUserId !== expectedOwnerUserId) return null;
    if (expectedOwnerUserId && session.schemaVersion >= ACTIVE_SESSION_SCHEMA_VERSION && !ownerUserId) return null;
    if (session.completionIntent) {
      await finalizeDeepWorkSession({
        session,
        expectedUserId: expectedOwnerUserId,
        reason: session.completionIntent.reason,
      });
      return null;
    }
  }

  if (session.phase === 'running') {
    const left = Math.max(
      Math.ceil((session.endTimestamp - Date.now()) / 1000),
      0
    );

    if (left <= 0) {
      if (isDeepWorkSyncEnabled() && (!session.ownerUserId || !session.clientSessionId)) {
        return { ...session, remaining: 0 };
      }

      await finalizeDeepWorkSession({
        session,
        expectedUserId,
        durationSeconds: session.totalSeconds || session.remaining,
        completedAt: new Date(session.endTimestamp).toISOString(),
        reason: 'restored',
      });
      return null;
    }

    return {
      ...session,
      remaining: left,
    };
  }

  return session;
}

export async function getDeepWorkTimeLeft() {
  try {
    const session = await getSavedDeepWorkSession();
    return session?.remaining || 0;
  } catch {
    return 0;
  }
}

export async function getDeepWorkHistory() {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    if (!raw) return [];

    const history = JSON.parse(raw);
    if (!Array.isArray(history)) return [];

    return history.map(normalizeHistoryEntry).filter(Boolean);
  } catch {
    return [];
  }
}

export async function saveDeepWorkHistory(history) {
  const safeHistory = Array.isArray(history)
    ? history.map(normalizeHistoryEntry).filter(Boolean)
    : [];

  const limitedHistory = safeHistory.slice(-MAX_HISTORY_ENTRIES);
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(limitedHistory));
}

export async function upsertDeepWorkHistoryEntry(entry) {
  const normalized = normalizeHistoryEntry(entry);
  if (!normalized) return null;
  const history = await getDeepWorkHistory();
  const stableId = normalized.clientSessionId || normalized.id;
  const existingIndex = history.findIndex((item) => (
    item.clientSessionId === stableId || item.id === stableId
  ));
  const nextHistory = [...history];
  if (existingIndex >= 0) {
    nextHistory[existingIndex] = normalized;
  } else {
    nextHistory.push(normalized);
  }
  await saveDeepWorkHistory(nextHistory);
  return normalized;
}

export async function addCompletedDeepWorkSession(durationSeconds, metadata = {}) {
  const safeDuration = Math.max(getSafeNumber(durationSeconds), 0);
  if (safeDuration <= 0) return null;

  const clientSessionId = optionalString(metadata.clientSessionId);
  const ownerUserId = optionalString(metadata.ownerUserId);
  const completedAt = normalizeIsoDate(metadata.completedAt) || new Date().toISOString();
  const id = clientSessionId || `${Date.now()}-${Math.round(safeDuration)}`;

  return upsertDeepWorkHistoryEntry({
    id,
    ...(clientSessionId ? { clientSessionId } : {}),
    ...(ownerUserId ? { ownerUserId } : {}),
    durationSeconds: Math.round(safeDuration),
    completedAt,
  });
}

async function getDeepWorkSyncQueueInternal(userId) {
  const ownerUserId = requireOwnerUserId(userId);
  const result = await readRequiredJson(
    queueKey(ownerUserId),
    'DEEP_WORK_SYNC_QUEUE_INVALID',
    'The sync queue document is invalid.'
  );
  if (!result.exists) return emptyQueue(ownerUserId);
  return normalizeQueueDocument(result.value, ownerUserId);
}

export async function getDeepWorkSyncQueue(userId) {
  const ownerUserId = await requireAuthenticatedQueueOwner(userId);
  const queue = await getDeepWorkSyncQueueInternal(ownerUserId);
  await requireAuthenticatedQueueOwner(ownerUserId);
  return queue;
}

export async function findDeepWorkSyncEntry(userId, clientSessionId) {
  const ownerUserId = await requireAuthenticatedQueueOwner(userId);
  const queue = await getDeepWorkSyncQueueInternal(ownerUserId);
  await requireAuthenticatedQueueOwner(ownerUserId);
  const stableId = optionalString(clientSessionId);
  return queue.entries.find((entry) => entry.clientSessionId === stableId) || null;
}

export async function upsertPendingDeepWorkSyncEntry(userId, entry) {
  const ownerUserId = await requireAuthenticatedQueueOwner(userId);
  const normalizedEntry = normalizeQueueEntry({ ...entry, status: 'pending' });
  if (!normalizedEntry) {
    throw new DeepWorkSyncStoreError('DEEP_WORK_SYNC_ENTRY_INVALID', 'The sync queue entry is invalid.');
  }
  return runQueueMutation(ownerUserId, async () => {
    const queue = await getDeepWorkSyncQueueInternal(ownerUserId);
    const existingIndex = queue.entries.findIndex(
      (item) => item.clientSessionId === normalizedEntry.clientSessionId
    );
    if (existingIndex >= 0) {
      const existing = queue.entries[existingIndex];
      if (
        existing.durationSeconds !== normalizedEntry.durationSeconds
        || existing.completedAt !== normalizedEntry.completedAt
      ) {
        throw new DeepWorkSyncStoreError('DEEP_WORK_SYNC_ENTRY_CONFLICT', 'The sync id is already used with different data.');
      }
      await requireAuthenticatedQueueOwner(ownerUserId);
      return existing;
    }
    await writeAuthenticatedDeepWorkSyncQueue(ownerUserId, {
      ...queue,
      entries: [...queue.entries, normalizedEntry],
    });
    return normalizedEntry;
  });
}

export async function removeDeepWorkSyncEntry(userId, clientSessionId) {
  const ownerUserId = await requireAuthenticatedQueueOwner(userId);
  const stableId = optionalString(clientSessionId);
  return runQueueMutation(ownerUserId, async () => {
    const queue = await getDeepWorkSyncQueueInternal(ownerUserId);
    const nextQueue = {
      ...queue,
      entries: queue.entries.filter((entry) => entry.clientSessionId !== stableId),
    };
    return writeAuthenticatedDeepWorkSyncQueue(ownerUserId, nextQueue);
  });
}

export async function markDeepWorkSyncEntryTerminal(userId, clientSessionId, errorCode) {
  const ownerUserId = await requireAuthenticatedQueueOwner(userId);
  const stableId = optionalString(clientSessionId);
  return runQueueMutation(ownerUserId, async () => {
    const queue = await getDeepWorkSyncQueueInternal(ownerUserId);
    const existingIndex = queue.entries.findIndex((entry) => entry.clientSessionId === stableId);
    if (existingIndex < 0) {
      await requireAuthenticatedQueueOwner(ownerUserId);
      return null;
    }
    const terminal = {
      ...queue.entries[existingIndex],
      status: 'terminal',
      nextAttemptAt: null,
      lastErrorCode: optionalString(errorCode) || 'UNKNOWN',
    };
    const entries = [...queue.entries];
    entries[existingIndex] = terminal;
    await writeAuthenticatedDeepWorkSyncQueue(ownerUserId, { ...queue, entries });
    return terminal;
  });
}

export async function getDeepWorkLegacyOwnerMarker() {
  return normalizeLegacyOwnerMarker(await readJson(LEGACY_OWNER_KEY));
}

async function getDeepWorkLegacyOwnerMarkerForClaim() {
  const raw = await AsyncStorage.getItem(LEGACY_OWNER_KEY);
  if (!raw) return null;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new DeepWorkSyncStoreError('DEEP_WORK_LEGACY_OWNER_INVALID', 'The legacy owner marker is invalid.');
  }
  const marker = normalizeLegacyOwnerMarker(parsed);
  if (!marker) {
    throw new DeepWorkSyncStoreError('DEEP_WORK_LEGACY_OWNER_INVALID', 'The legacy owner marker is invalid.');
  }
  return marker;
}

function legacyEntryKey(entry, occurrence) {
  return [entry.id, entry.completedAt, entry.durationSeconds, occurrence].join('|');
}

function canonicalLegacyEntries(history) {
  return history
    .map((entry, originalIndex) => ({ entry: normalizeHistoryEntry(entry), originalIndex }))
    .filter(({ entry }) => entry && !entry.clientSessionId)
    .sort((a, b) => (
      a.entry.completedAt.localeCompare(b.entry.completedAt)
      || a.entry.durationSeconds - b.entry.durationSeconds
      || a.entry.id.localeCompare(b.entry.id)
      || a.originalIndex - b.originalIndex
    ))
    .map(({ entry }, occurrence) => ({ entry, legacyKey: legacyEntryKey(entry, occurrence) }));
}

function createUniqueLegacyId(createId, usedIds) {
  for (let attempt = 0; attempt < MAX_ID_GENERATION_ATTEMPTS; attempt += 1) {
    const candidate = optionalString(createId());
    if (candidate && candidate.length <= 128 && !usedIds.has(candidate)) {
      usedIds.add(candidate);
      return candidate;
    }
  }
  throw new DeepWorkSyncStoreError(
    'DEEP_WORK_LEGACY_ID_COLLISION',
    'A unique legacy session id could not be generated.'
  );
}

async function claimLegacyDeepWorkDataInternal(ownerUserId, { createId, now }) {
  const nowIso = () => new Date(now()).toISOString();
  let marker = await getDeepWorkLegacyOwnerMarkerForClaim();

  if (!marker) {
    marker = {
      schemaVersion: LEGACY_OWNER_SCHEMA_VERSION,
      ownerUserId,
      state: 'claiming',
      claimedAt: nowIso(),
      completedAt: null,
    };
    await AsyncStorage.setItem(LEGACY_OWNER_KEY, JSON.stringify(marker));
  } else if (marker.ownerUserId !== ownerUserId) {
    return { claimed: false, reason: 'owned_by_another_user', marker };
  }

  let queue;
  if (marker.state !== 'completed') {
    const history = await getDeepWorkHistory();
    queue = await runQueueMutation(ownerUserId, async () => {
      const currentQueue = await getDeepWorkSyncQueue(ownerUserId);
      const existingLegacyByKey = new Map(
        currentQueue.entries.filter((entry) => entry.legacyKey).map((entry) => [entry.legacyKey, entry])
      );
      const usedIds = new Set([
        ...currentQueue.entries.map((entry) => entry.clientSessionId),
        ...history.map((entry) => optionalString(entry?.clientSessionId) || optionalString(entry?.id)).filter(Boolean),
      ]);
      const additions = canonicalLegacyEntries(history).map(({ entry, legacyKey }) => {
        const existing = existingLegacyByKey.get(legacyKey);
        return existing || normalizeQueueEntry({
          clientSessionId: createUniqueLegacyId(createId, usedIds),
          durationSeconds: entry.durationSeconds,
          completedAt: entry.completedAt,
          status: 'pending',
          attempts: 0,
          nextAttemptAt: null,
          lastErrorCode: null,
          source: 'legacy',
          legacyKey,
        });
      }).filter(Boolean);
      return writeAuthenticatedDeepWorkSyncQueue(ownerUserId, {
        ...currentQueue,
        entries: [...currentQueue.entries, ...additions.filter((entry) => (
          !currentQueue.entries.some((current) => current.clientSessionId === entry.clientSessionId)
        ))],
      });
    });

    const activeSession = await readJson(KEY);
    const normalizedActive = normalizeSession(activeSession);
    if (
      normalizedActive
      && ((
        !normalizedActive.ownerUserId
        && normalizedActive.schemaVersion !== ACTIVE_SESSION_SCHEMA_VERSION
      ) || (
        normalizedActive.ownerUserId === ownerUserId
        && !normalizedActive.clientSessionId
      ))
    ) {
      const activeUsedIds = new Set([
        ...queue.entries.map((entry) => entry.clientSessionId),
        ...history.map((entry) => optionalString(entry?.clientSessionId) || optionalString(entry?.id)).filter(Boolean),
      ]);
      await saveDeepWorkSession({
        ...normalizedActive,
        schemaVersion: ACTIVE_SESSION_SCHEMA_VERSION,
        ownerUserId,
        clientSessionId: createUniqueLegacyId(createId, activeUsedIds),
        legacyClaimEligible: false,
        startedAt: normalizeIsoDate(activeSession?.startedAt) || new Date(normalizedActive.updatedAt).toISOString(),
      });
    }

    marker = {
      ...marker,
      state: 'completed',
      completedAt: nowIso(),
    };
    await AsyncStorage.setItem(LEGACY_OWNER_KEY, JSON.stringify(marker));
  } else {
    queue = await getDeepWorkSyncQueue(ownerUserId);
  }

  if (!queue.legacyImportCompleted) {
    queue = await runQueueMutation(ownerUserId, async () => {
      const currentQueue = await getDeepWorkSyncQueue(ownerUserId);
      return writeAuthenticatedDeepWorkSyncQueue(ownerUserId, {
        ...currentQueue,
        legacyImportCompleted: true,
      });
    });
  }

  return { claimed: true, marker, queue };
}

export async function claimLegacyDeepWorkData(userId, {
  createId = createDeepWorkClientSessionId,
  now = Date.now,
} = {}) {
  if (!isDeepWorkSyncEnabled()) return { claimed: false, reason: 'disabled' };
  const ownerUserId = await requireAuthenticatedQueueOwner(userId);
  while (legacyClaimFlight) {
    try {
      await legacyClaimFlight;
    } catch {
      // The persisted claiming marker remains authoritative after a failed flight.
    }
  }
  const flight = claimLegacyDeepWorkDataInternal(ownerUserId, { createId, now });
  legacyClaimFlight = flight;
  try {
    return await flight;
  } finally {
    if (legacyClaimFlight === flight) legacyClaimFlight = null;
  }
}

export async function finalizeDeepWorkSession({
  session,
  durationSeconds,
  completedAt,
  reason = 'manual',
  expectedUserId,
}) {
  if (!isDeepWorkSyncEnabled()) {
    const safeDuration = Math.round(Math.max(getSafeNumber(durationSeconds), 0));
    if (safeDuration <= 0) {
      await clearDeepWorkSession();
      return null;
    }
    const historyEntry = await addCompletedDeepWorkSession(safeDuration);
    await clearDeepWorkSession();
    return historyEntry;
  }

  assertSessionOwner(session, expectedUserId);
  const existingIntent = normalizeCompletionIntent(session?.completionIntent);
  const safeDuration = Math.round(Math.max(getSafeNumber(durationSeconds), 0));
  if (!existingIntent && safeDuration <= 0) {
    await clearDeepWorkSession(expectedUserId);
    return null;
  }

  const ownerUserId = optionalString(session?.ownerUserId);
  const clientSessionId = optionalString(session?.clientSessionId);
  const completionIntent = existingIntent || {
    schemaVersion: COMPLETION_INTENT_SCHEMA_VERSION,
    status: 'pending',
    reason: ['manual', 'natural', 'restored'].includes(reason) ? reason : 'manual',
    durationSeconds: safeDuration,
    completedAt: normalizeIsoDate(completedAt) || new Date().toISOString(),
  };
  const persistedSession = existingIntent ? session : {
    ...session,
    completionIntent,
  };
  const finalizedSession = await writeDeepWorkSession(
    persistedSession,
    { allowNewCompletionIntent: true }
  );
  const authoritativeIntent = finalizedSession.completionIntent;

  if (ownerUserId && clientSessionId) {
    await upsertPendingDeepWorkSyncEntry(ownerUserId, {
      clientSessionId,
      durationSeconds: authoritativeIntent.durationSeconds,
      completedAt: authoritativeIntent.completedAt,
      source: 'new',
    });
    const historyEntry = await addCompletedDeepWorkSession(authoritativeIntent.durationSeconds, {
      clientSessionId,
      ownerUserId,
      completedAt: authoritativeIntent.completedAt,
    });
    await clearDeepWorkSession(expectedUserId);
    return historyEntry;
  }

  const historyEntry = await addCompletedDeepWorkSession(authoritativeIntent.durationSeconds, {
    clientSessionId,
    completedAt: authoritativeIntent.completedAt,
  });
  await clearDeepWorkSession(expectedUserId);
  return historyEntry;
}

export async function getTodayDeepWorkSeconds() {
  const history = await cleanupDeepWorkHistory();

  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const startTime = start.getTime();
  const endTime = end.getTime();

  return history.reduce((sum, session) => {
    const completedTime = new Date(session.completedAt).getTime();

    if (completedTime >= startTime && completedTime <= endTime) {
      return sum + (session.durationSeconds || 0);
    }

    return sum;
  }, 0);
}

export async function cleanupDeepWorkHistory() {
  const history = await getDeepWorkHistory();

  if (isDeepWorkSyncEnabled()) {
    const marker = await getDeepWorkLegacyOwnerMarker();
    if (!marker || marker.state === 'claiming') return history;
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - DEEP_WORK_HISTORY_RETENTION_DAYS);
  cutoff.setHours(0, 0, 0, 0);

  const cutoffTime = cutoff.getTime();

  const cleanedHistory = history.filter((session) => {
    const completedTime = new Date(session.completedAt).getTime();
    return completedTime >= cutoffTime;
  });

  if (cleanedHistory.length !== history.length) {
    await saveDeepWorkHistory(cleanedHistory);
  }

  return cleanedHistory;
}
