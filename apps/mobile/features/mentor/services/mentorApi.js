import { ProfileApiError, requestProfileV1 } from '../../profile/services/profiles';
import {
  getMentorErrorMessage,
  normalizeMentorConversation,
  normalizeMentorAction,
  normalizeMentorConversationList,
  normalizeMentorMemory,
  normalizeMentorMemoryList,
  normalizeMentorMessagePage,
  normalizeMentorSendResult,
  normalizeMentorSettings,
  normalizeMentorUsage,
} from './mentorNormalizers';

// Client-side feature flag. When false the app keeps showing the original
// mentor placeholder, so OTA updates do not change the running beta.
const MENTOR_API_ENABLED = process.env.EXPO_PUBLIC_MENTOR_API_ENABLED === 'true';

export const MENTOR_MESSAGE_MAX_LENGTH = 4000;

export class MentorApiError extends Error {
  constructor(message, { status = null, code = null, details = null } = {}) {
    super(message);
    this.name = 'MentorApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** Backend has the mentor routes switched off (feature flag). */
  get isUnavailable() {
    return this.status === 404 && this.code === 'NOT_FOUND';
  }

  get userMessage() {
    return getMentorErrorMessage(this.code, {
      resetsAt: this.details?.usage?.resets_at ?? null,
    });
  }
}

export function isMentorApiEnabled() {
  return MENTOR_API_ENABLED;
}

async function requestMentor(path, options, normalize) {
  try {
    return await requestProfileV1(path, options, normalize);
  } catch (error) {
    if (error instanceof ProfileApiError) {
      throw new MentorApiError('Mentor request failed.', {
        status: error.status,
        code: error.code,
        details: error.details,
      });
    }
    if (error?.code === 'MENTOR_API_INVALID_RESPONSE') {
      throw new MentorApiError(error.message, { code: error.code });
    }
    throw error;
  }
}

function jsonRequest(method, body) {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export function getMentorSettings() {
  return requestMentor('/v1/mentor/settings', { method: 'GET' }, normalizeMentorSettings);
}

export function grantMentorConsent(version = 'v1') {
  return requestMentor('/v1/mentor/consent', jsonRequest('PUT', { version }), normalizeMentorSettings);
}

export function withdrawMentorConsent() {
  return requestMentor('/v1/mentor/consent', { method: 'DELETE' }, normalizeMentorSettings);
}

export function getMentorUsage() {
  return requestMentor('/v1/mentor/usage', { method: 'GET' }, normalizeMentorUsage);
}

export function listMentorConversations({ page = 0, limit = 20 } = {}) {
  return requestMentor(
    `/v1/mentor/conversations?limit=${limit}&page=${page}`,
    { method: 'GET' },
    normalizeMentorConversationList,
  );
}

export function listMentorMessages(conversationId, { before = null, limit = 50 } = {}) {
  const query = before ? `limit=${limit}&before=${encodeURIComponent(before)}` : `limit=${limit}`;
  return requestMentor(
    `/v1/mentor/conversations/${encodeURIComponent(conversationId)}/messages?${query}`,
    { method: 'GET' },
    normalizeMentorMessagePage,
  );
}

export function sendMentorMessage({ conversationId = null, content }) {
  const body = { content };
  if (conversationId) body.conversation_id = conversationId;
  return requestMentor('/v1/mentor/messages', jsonRequest('POST', body), normalizeMentorSendResult);
}

export function renameMentorConversation(conversationId, title) {
  return requestMentor(
    `/v1/mentor/conversations/${encodeURIComponent(conversationId)}`,
    jsonRequest('PATCH', { title }),
    (payload) => normalizeMentorConversation(payload?.conversation),
  );
}

export function deleteMentorConversation(conversationId) {
  return requestMentor(
    `/v1/mentor/conversations/${encodeURIComponent(conversationId)}`,
    { method: 'DELETE' },
    () => null,
  );
}

export function updateMentorSettings({ memoryEnabled }) {
  return requestMentor(
    '/v1/mentor/settings',
    jsonRequest('PATCH', { memory_enabled: memoryEnabled }),
    normalizeMentorSettings,
  );
}

export function listMentorMemories() {
  return requestMentor('/v1/mentor/memories', { method: 'GET' }, normalizeMentorMemoryList);
}

export function updateMentorMemory(memoryId, { content, status } = {}) {
  const body = {};
  if (content !== undefined) body.content = content;
  if (status !== undefined) body.status = status;
  return requestMentor(
    `/v1/mentor/memories/${encodeURIComponent(memoryId)}`,
    jsonRequest('PATCH', body),
    (payload) => normalizeMentorMemory(payload?.memory),
  );
}

export function deleteMentorMemory(memoryId) {
  return requestMentor(
    `/v1/mentor/memories/${encodeURIComponent(memoryId)}`,
    { method: 'DELETE' },
    () => null,
  );
}

export function deleteAllMentorMemories() {
  return requestMentor('/v1/mentor/memories', { method: 'DELETE' }, () => null);
}

export function confirmMentorAction(actionId) {
  return requestMentor(
    `/v1/mentor/actions/${encodeURIComponent(actionId)}/confirm`,
    { method: 'POST' },
    (payload) => normalizeMentorAction(payload?.action),
  );
}

export function rejectMentorAction(actionId) {
  return requestMentor(
    `/v1/mentor/actions/${encodeURIComponent(actionId)}/reject`,
    { method: 'POST' },
    (payload) => normalizeMentorAction(payload?.action),
  );
}
