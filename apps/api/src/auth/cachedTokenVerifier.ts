import { createHash } from 'node:crypto';
import type { AuthTokenVerifier, AuthUser } from './types.js';

type CachedTokenVerifierOptions = {
  // How long a successful verification is reused. Kept short on purpose: a session that is
  // revoked in Supabase stays usable against this API for at most this long.
  ttlMs?: number;
  maxEntries?: number;
  now?: () => number;
};

type Entry = { user: AuthUser; expiresAt: number };

const DEFAULT_TTL_MS = 60_000;
const DEFAULT_MAX_ENTRIES = 5_000;

// Reads the `exp` claim without verifying the signature. It is only used to make sure a
// cached entry never outlives the token itself; the token was already verified by the
// wrapped verifier before it is cached.
function tokenExpiryMs(token: string): number | null {
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const exp = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))?.exp;
    return typeof exp === 'number' && Number.isFinite(exp) ? exp * 1000 : null;
  } catch {
    return null;
  }
}

// Wraps a token verifier (Supabase `auth.getUser`, a network round trip per call) with a
// short in-memory cache of successful verifications, so a screen that fires several API
// requests at once does not pay that round trip for every single request. Failed
// verifications are never cached.
export function createCachedTokenVerifier(
  verify: AuthTokenVerifier,
  { ttlMs = DEFAULT_TTL_MS, maxEntries = DEFAULT_MAX_ENTRIES, now = Date.now }: CachedTokenVerifierOptions = {},
): AuthTokenVerifier {
  const entries = new Map<string, Entry>();
  const pending = new Map<string, Promise<AuthUser | null>>();

  return async (token) => {
    const key = createHash('sha256').update(token).digest('hex');
    const current = now();
    const cached = entries.get(key);
    if (cached && cached.expiresAt > current) return cached.user;
    if (cached) entries.delete(key);

    const inFlight = pending.get(key);
    if (inFlight) return inFlight;

    const request = (async () => {
      const user = await verify(token);
      if (user) {
        const tokenExpiry = tokenExpiryMs(token);
        const expiresAt = Math.min(now() + ttlMs, tokenExpiry ?? Number.POSITIVE_INFINITY);
        if (expiresAt > now()) {
          if (entries.size >= maxEntries) {
            // Map keeps insertion order, so the first key is the oldest entry.
            const oldest = entries.keys().next().value;
            if (oldest !== undefined) entries.delete(oldest);
          }
          entries.set(key, { user, expiresAt });
        }
      }
      return user;
    })();
    pending.set(key, request);
    try {
      return await request;
    } finally {
      pending.delete(key);
    }
  };
}
