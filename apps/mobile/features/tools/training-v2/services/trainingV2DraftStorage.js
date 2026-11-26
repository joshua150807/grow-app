import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '../../../../services/supabaseClient';
import { createTrainingV2LogicalKey } from '../services/trainingV2LogicalId';

const DRAFT_SCHEMA_VERSION = 1;
const DRAFT_KEY_PREFIX = 'training-v2:draft:';
const operations = new Map();
function enqueue(key, operation) {
  const next = (operations.get(key) ?? Promise.resolve()).catch(() => {}).then(operation);
  operations.set(key, next);
  const cleanup = () => { if (operations.get(key) === next) operations.delete(key); };
  next.then(cleanup, cleanup);
  return next;
}

function ownerKeyPrefix(ownerId) {
  return `${DRAFT_KEY_PREFIX}${encodeURIComponent(ownerId)}:`;
}

// Deletes every persisted draft (the create-draft and any edit:<planId> drafts) belonging
// to exactly one owner — scoped by key prefix, so it can never touch another owner's
// entries even if several owners have used this device. Called for real, not just a
// blocked-access check, whenever that owner stops being the signed-in user.
async function deleteAllDraftsForOwner(ownerId) {
  const prefix = ownerKeyPrefix(ownerId);
  await Promise.all([...operations].filter(([key]) => key.startsWith(prefix)).map(([, task]) => task.catch(() => {})));
  const allKeys = await AsyncStorage.getAllKeys();
  const ownerKeys = allKeys.filter((key) => key.startsWith(prefix));
  if (ownerKeys.length > 0) {
    await AsyncStorage.multiRemove(ownerKeys);
  }
}

// Mirrors trainingV2PlansCache.js's single, module-level auth subscription: tracks the
// current owner for the lifetime of the app so a read/write can always be checked against
// who is actually signed in right now, not who a caller (possibly stale by the time its
// promise resolves) believes is signed in. Unlike the plans cache, losing ownership here
// must not just stop being readable — but persisted drafts are only ever *deleted* on a
// real sign-out (nextOwnerId becomes null). A direct switch to a different account without
// an intervening sign-out (previousOwnerId and nextOwnerId both real, different ids) must
// leave the departed owner's drafts on disk untouched — they simply become unreadable to
// the new owner (enforced below by the currentOwnerId check in load/save), in case that
// owner signs back in later. If the real auth flow for switching accounts happens to fire
// an actual SIGNED_OUT/null transition first (as most re-authentication flows do), the
// deletion below runs for that step exactly as it would for any other logout — correctly.
let currentOwnerId = null;
let ownerGeneration = 0;

supabase.auth.onAuthStateChange((_event, session) => {
  const previousOwnerId = currentOwnerId;
  const nextOwnerId = session?.user?.id ?? null;
  if (nextOwnerId !== previousOwnerId) ownerGeneration += 1;
  currentOwnerId = nextOwnerId;
  if (previousOwnerId && nextOwnerId === null) {
    void deleteAllDraftsForOwner(previousOwnerId).catch(() => {});
  }
});

export class TrainingV2DraftOwnerError extends Error {
  constructor(message = 'A draft owner is required.') {
    super(message);
    this.name = 'TrainingV2DraftOwnerError';
  }
}

function requireOwnerUserId(userId) {
  const normalized = typeof userId === 'string' && userId.trim() ? userId.trim() : null;
  if (!normalized) {
    throw new TrainingV2DraftOwnerError();
  }
  return normalized;
}

function draftKey(ownerUserId, mode, planId) {
  const owner = encodeURIComponent(ownerUserId);
  return mode === 'edit'
    ? `training-v2:draft:${owner}:edit:${encodeURIComponent(planId)}`
    : `training-v2:draft:${owner}:create`;
}

export function getTrainingV2DraftOwnerId() {
  return currentOwnerId;
}

// Never returns a foreign owner's draft, even if called with a stale userId argument (e.g. a
// read started just before a logout/user-switch resolving after it) — the live, currently
// signed-in owner is always the final word.
export async function loadTrainingV2Draft(userId, mode, planId) {
  const owner = requireOwnerUserId(userId);
  if (currentOwnerId !== owner) return null;

  const generation = ownerGeneration;
  const key = draftKey(owner, mode, planId);
  await operations.get(key)?.catch(() => {});
  const raw = await AsyncStorage.getItem(key);
  if (currentOwnerId !== owner || generation !== ownerGeneration) return null;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (
      !parsed
      || parsed.schemaVersion !== DRAFT_SCHEMA_VERSION
      || parsed.userId !== owner
      || parsed.mode !== mode
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function saveTrainingV2Draft(userId, mode, planId, { basePlanVersion = null, editorState }) {
  const owner = requireOwnerUserId(userId);
  if (currentOwnerId !== owner) return;

  const document = {
    schemaVersion: DRAFT_SCHEMA_VERSION,
    userId: owner,
    mode,
    planId: mode === 'edit' ? planId : null,
    basePlanVersion: mode === 'edit' ? basePlanVersion : null,
    updatedAt: new Date().toISOString(),
    editorState,
  };
  const generation = ownerGeneration;
  return enqueue(draftKey(owner, mode, planId), async () => {
    if (currentOwnerId !== owner || generation !== ownerGeneration) return;
    if (mode === 'create') {
      const raw = await AsyncStorage.getItem(draftKey(owner, mode, planId));
      const previous = raw ? JSON.parse(raw) : null;
      // An autosave captured before the POST must not replace the persisted replay.
      if (previous?.userId === owner && previous?.editorState?.pendingCreate) {
        document.editorState = previous.editorState;
      }
      if (currentOwnerId !== owner || generation !== ownerGeneration) return;
    }
    await AsyncStorage.setItem(draftKey(owner, mode, planId), JSON.stringify(document));
  });
}

// Freeze and persist the complete logical create BEFORE any network request. This uses
// the same owner/key/queue as editor autosave, so restart and delayed autosave replay it.
export async function prepareTrainingV2PlanCreate(editorState, input) {
  const generationAtStart = ownerGeneration;
  const ownerAtStart = currentOwnerId;
  const { data, error } = await supabase.auth.getSession();
  const owner = data?.session?.user?.id;
  const firstResolution = ownerAtStart === null && ownerGeneration === generationAtStart + 1 && currentOwnerId === owner;
  if (error || !owner || (generationAtStart !== ownerGeneration && !firstResolution)) {
    throw new TrainingV2DraftOwnerError('Die Anmeldung hat sich geändert. Öffne den Planeditor erneut.');
  }
  if (currentOwnerId === null && generationAtStart === ownerGeneration) {
    currentOwnerId = owner;
    ownerGeneration += 1;
  }
  if (currentOwnerId !== owner) throw new TrainingV2DraftOwnerError('Das angemeldete Konto hat sich geändert.');
  const generation = ownerGeneration;
  const key = draftKey(owner, 'create');
  const requireCurrentOwner = () => {
    if (currentOwnerId !== owner || generation !== ownerGeneration) throw new TrainingV2DraftOwnerError('Das angemeldete Konto hat sich geändert.');
  };
  return enqueue(key, async () => {
    requireCurrentOwner();
    const raw = await AsyncStorage.getItem(key);
    requireCurrentOwner();
    const previous = raw ? JSON.parse(raw) : null;
    if (previous && (previous.schemaVersion !== DRAFT_SCHEMA_VERSION || previous.userId !== owner || previous.mode !== 'create')) {
      throw new Error('Der gespeicherte Planentwurf konnte nicht sicher gelesen werden.');
    }
    if (previous?.editorState?.pendingCreate) return { editorState: previous.editorState, ownerId: owner };
    const snapshot = { ...editorState, pendingCreate: { input: { ...input, idempotencyKey: createTrainingV2LogicalKey() } } };
    await AsyncStorage.setItem(key, JSON.stringify({ schemaVersion: DRAFT_SCHEMA_VERSION, userId: owner,
      mode: 'create', planId: null, basePlanVersion: null, updatedAt: new Date().toISOString(), editorState: snapshot }));
    requireCurrentOwner();
    return { editorState: snapshot, ownerId: owner };
  });
}

export async function clearTrainingV2Draft(userId, mode, planId) {
  const owner = requireOwnerUserId(userId);
  return enqueue(draftKey(owner, mode, planId), () => AsyncStorage.removeItem(draftKey(owner, mode, planId)));
}
