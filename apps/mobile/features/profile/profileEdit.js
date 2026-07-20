export const PROFILE_MOTTO = 'It only takes one day to change everything';

const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;

export function getVisibleProfileBio(bio) {
  return typeof bio === 'string' && bio.trim() ? bio : PROFILE_MOTTO;
}

export function createProfileEditDraft(username, bio) {
  return {
    username: typeof username === 'string' ? username : '',
    bio: getVisibleProfileBio(bio),
  };
}

export function validateProfileUsername(value) {
  const normalized = value.trim().toLowerCase();

  if (normalized.length < 3) return 'Mindestens 3 Zeichen.';
  if (normalized.length > 30) return 'Maximal 30 Zeichen.';
  if (!USERNAME_REGEX.test(normalized)) return 'Nur Buchstaben, Zahlen und Unterstrich.';
  return '';
}

export function validateProfileBio(value) {
  return value.trim().length > 100 ? 'Maximal 100 Zeichen.' : '';
}

export function buildProfileChanges({ usernameDraft, bioDraft, username, bio }) {
  const normalizedUsername = usernameDraft.trim().toLowerCase();
  const normalizedBio = bioDraft.trim();
  const changes = {};

  if (normalizedUsername !== username.trim().toLowerCase()) {
    changes.username = normalizedUsername;
  }

  if (normalizedBio !== bio.trim()) {
    changes.bio = normalizedBio;
  }

  return changes;
}
