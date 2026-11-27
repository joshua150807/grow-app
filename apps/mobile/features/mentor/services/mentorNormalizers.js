// Pure helpers for KI Mentor API payloads. No React Native imports so they
// can be unit tested with node:test.

function toText(value) {
  return typeof value === 'string' ? value : '';
}

function toNumber(value, fallback = 0) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

export function normalizeMentorSettings(payload) {
  const settings = payload?.settings ?? payload;
  return {
    hasConsent: settings?.has_consent === true,
    consentRequiredVersion: toText(settings?.consent_required_version) || 'v1',
    consentedAt: settings?.consented_at ?? null,
    memoryEnabled: settings?.memory_enabled !== false,
    journalAccessEnabled: settings?.journal_access_enabled === true,
    notesAccessEnabled: settings?.notes_access_enabled === true,
  };
}

export function normalizeMentorUsage(payload) {
  const usage = payload?.usage ?? payload;
  const limit = Math.max(toNumber(usage?.limit), 0);
  const used = Math.max(toNumber(usage?.used), 0);
  return {
    used,
    limit,
    remaining: Math.max(toNumber(usage?.remaining, limit - used), 0),
    resetsAt: usage?.resets_at ?? null,
  };
}

export function normalizeMentorConversation(payload) {
  if (!payload || typeof payload !== 'object' || !payload.id) return null;
  return {
    id: payload.id,
    title: toText(payload.title).trim() || 'Neuer Chat',
    lastMessageAt: payload.last_message_at ?? null,
    createdAt: payload.created_at ?? null,
  };
}

export function normalizeMentorMessage(payload) {
  if (!payload || typeof payload !== 'object' || !payload.id) return null;
  if (payload.role !== 'user' && payload.role !== 'assistant') return null;
  return {
    id: payload.id,
    conversationId: payload.conversation_id ?? null,
    role: payload.role,
    content: toText(payload.content),
    createdAt: payload.created_at ?? null,
  };
}

export function normalizeMentorConversationList(payload) {
  const conversations = Array.isArray(payload?.conversations) ? payload.conversations : [];
  return {
    conversations: conversations.map(normalizeMentorConversation).filter(Boolean),
    page: toNumber(payload?.page),
    hasMore: payload?.has_more === true,
  };
}

export function normalizeMentorMessagePage(payload) {
  const messages = Array.isArray(payload?.messages) ? payload.messages : [];
  return {
    conversation: normalizeMentorConversation(payload?.conversation),
    messages: messages.map(normalizeMentorMessage).filter(Boolean),
    hasMore: payload?.has_more === true,
  };
}

export function normalizeMentorSendResult(payload) {
  const conversation = normalizeMentorConversation(payload?.conversation);
  const userMessage = normalizeMentorMessage(payload?.user_message);
  const assistantMessage = normalizeMentorMessage(payload?.assistant_message);
  if (!conversation || !userMessage || !assistantMessage) {
    const error = new Error('Mentor API returned an invalid message response.');
    error.code = 'MENTOR_API_INVALID_RESPONSE';
    throw error;
  }
  return {
    conversation,
    userMessage,
    assistantMessage,
    crisisResourcesShown: payload?.safety?.crisis_resources_shown === true,
    usage: normalizeMentorUsage(payload?.usage),
  };
}

function formatResetTime(resetsAt) {
  if (!resetsAt) return null;
  const date = new Date(resetsAt);
  if (Number.isNaN(date.getTime())) return null;
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/** German, user-facing text for an API error code. */
export function getMentorErrorMessage(code, { resetsAt = null } = {}) {
  switch (code) {
    case 'MENTOR_DAILY_LIMIT_REACHED': {
      const time = formatResetTime(resetsAt);
      return time
        ? `Du hast dein Tageslimit für den Mentor erreicht. Ab ${time} Uhr geht es weiter.`
        : 'Du hast dein Tageslimit für den Mentor erreicht. Morgen geht es weiter.';
    }
    case 'MENTOR_RATE_LIMITED':
      return 'Du schreibst gerade sehr schnell. Warte kurz und versuch es dann noch einmal.';
    case 'MENTOR_PROVIDER_TIMEOUT':
      return 'Der Mentor braucht gerade zu lange. Versuch es bitte noch einmal.';
    case 'MENTOR_PROVIDER_RATE_LIMITED':
      return 'Der Mentor ist gerade sehr gefragt. Versuch es in ein paar Minuten noch einmal.';
    case 'MENTOR_PROVIDER_UNAVAILABLE':
      return 'Der Mentor ist gerade nicht erreichbar. Versuch es später noch einmal.';
    case 'MENTOR_CONVERSATION_NOT_FOUND':
      return 'Dieser Chat existiert nicht mehr.';
    case 'MENTOR_CONSENT_REQUIRED':
      return 'Bitte stimme zuerst den Hinweisen zum KI Mentor zu.';
    case 'VALIDATION_ERROR':
      return 'Deine Nachricht konnte nicht gesendet werden. Prüfe bitte die Länge.';
    case 'PROFILE_API_NETWORK_ERROR':
      return 'Keine Verbindung. Prüfe dein Internet und versuch es erneut.';
    case 'PROFILE_API_SESSION_MISSING':
    case 'UNAUTHORIZED':
      return 'Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.';
    default:
      return 'Etwas ist schiefgelaufen. Versuch es bitte noch einmal.';
  }
}
