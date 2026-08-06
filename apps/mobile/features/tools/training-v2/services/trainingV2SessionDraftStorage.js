import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '../../../../services/supabaseClient';

const DRAFT_SCHEMA_VERSION = 1;
const KEY_PREFIX = 'training-v2:draft:session:';

function ownerPrefix(ownerId) {
  return `${KEY_PREFIX}${encodeURIComponent(ownerId)}:`;
}

function draftKey(ownerId, planId, unitId) {
  return `${ownerPrefix(ownerId)}${encodeURIComponent(planId)}:${encodeURIComponent(unitId)}`;
}

// A separate module-level auth subscription from trainingV2DraftStorage.js (the plan editor's
// own draft module) — kept fully independent on purpose, so this feature can never change that
// module's behavior. Unlike that module, a sign-out here never deletes anything: it only clears
// this in-memory pointer, which is enough on its own (every read/write below is gated on
// `currentOwnerId !== owner`) to stop a different user from ever loading the signed-out owner's
// draft. The persisted draft itself survives untouched — including through a real sign-out — so
// the original owner gets it back on their next login. It is deleted only by an explicit discard
// or a successful save (see clearTrainingV2SessionDraft's call sites).
let currentOwnerId = null;

supabase.auth.onAuthStateChange((_event, session) => {
  currentOwnerId = session?.user?.id ?? null;
});

export class TrainingV2SessionDraftOwnerError extends Error {
  constructor(message = 'A draft owner is required.') {
    super(message);
    this.name = 'TrainingV2SessionDraftOwnerError';
  }
}

function requireOwnerUserId(userId) {
  const normalized = typeof userId === 'string' && userId.trim() ? userId.trim() : null;
  if (!normalized) throw new TrainingV2SessionDraftOwnerError();
  return normalized;
}

export function getTrainingV2SessionDraftOwnerId() {
  return currentOwnerId;
}

export async function loadTrainingV2SessionDraft(userId, planId, unitId) {
  const owner = requireOwnerUserId(userId);
  if (currentOwnerId !== owner) return null;

  const raw = await AsyncStorage.getItem(draftKey(owner, planId, unitId));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (
      !parsed
      || parsed.schemaVersion !== DRAFT_SCHEMA_VERSION
      || parsed.userId !== owner
      || parsed.planId !== planId
      || parsed.unitId !== unitId
    ) {
      return null;
    }
    return parsed.session;
  } catch {
    return null;
  }
}

export async function saveTrainingV2SessionDraft(userId, planId, unitId, session) {
  const owner = requireOwnerUserId(userId);
  if (currentOwnerId !== owner) return;

  const document = {
    schemaVersion: DRAFT_SCHEMA_VERSION,
    userId: owner,
    planId,
    unitId,
    updatedAt: new Date().toISOString(),
    session,
  };
  await AsyncStorage.setItem(draftKey(owner, planId, unitId), JSON.stringify(document));
}

export async function clearTrainingV2SessionDraft(userId, planId, unitId) {
  const owner = requireOwnerUserId(userId);
  await AsyncStorage.removeItem(draftKey(owner, planId, unitId));
}

// Used by "Mein Training" to offer "Weiterführen" without the caller having to already know
// which unit was in progress. Only ever scans this owner's own keys (prefix-scoped, same as
// the logout deletion above), and only within the given plan — a draft for a different plan
// (e.g. a previously active plan the user later switched away from) is never returned here.
export async function findTrainingV2SessionDraftForPlan(userId, planId) {
  const owner = requireOwnerUserId(userId);
  if (currentOwnerId !== owner) return null;

  const prefix = `${ownerPrefix(owner)}${encodeURIComponent(planId)}:`;
  const allKeys = await AsyncStorage.getAllKeys();
  const planKeys = allKeys.filter((key) => key.startsWith(prefix));
  if (planKeys.length === 0) return null;

  const documents = (await Promise.all(planKeys.map(async (key) => {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.schemaVersion !== DRAFT_SCHEMA_VERSION || parsed.userId !== owner) return null;
      return parsed;
    } catch {
      return null;
    }
  }))).filter(Boolean);
  if (documents.length === 0) return null;

  documents.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  const latest = documents[0];
  return { unitId: latest.unitId, session: latest.session };
}
