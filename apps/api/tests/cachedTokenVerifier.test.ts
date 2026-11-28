import { describe, expect, it, vi } from 'vitest';
import { createCachedTokenVerifier } from '../src/auth/cachedTokenVerifier.js';

const user = { id: 'user-1', email: null, role: 'authenticated' };

function jwt(expSeconds?: number) {
  const payload = Buffer.from(JSON.stringify(expSeconds === undefined ? {} : { exp: expSeconds })).toString('base64url');
  return `header.${payload}.signature`;
}

describe('createCachedTokenVerifier', () => {
  it('reuses a successful verification within the TTL and re-verifies after it', async () => {
    let clock = 1_000_000;
    const verify = vi.fn(async () => user);
    const cached = createCachedTokenVerifier(verify, { ttlMs: 60_000, now: () => clock });
    const token = jwt(clock / 1000 + 3600);

    expect(await cached(token)).toEqual(user);
    clock += 59_000;
    expect(await cached(token)).toEqual(user);
    expect(verify).toHaveBeenCalledOnce();

    clock += 2_000;
    expect(await cached(token)).toEqual(user);
    expect(verify).toHaveBeenCalledTimes(2);
  });

  it('never caches failed verifications', async () => {
    const verify = vi.fn(async () => null);
    const cached = createCachedTokenVerifier(verify);
    expect(await cached(jwt())).toBeNull();
    expect(await cached(jwt())).toBeNull();
    expect(verify).toHaveBeenCalledTimes(2);
  });

  it('does not let a cache entry outlive the token expiry', async () => {
    let clock = 1_000_000;
    const verify = vi.fn(async () => user);
    const cached = createCachedTokenVerifier(verify, { ttlMs: 60_000, now: () => clock });
    const token = jwt(clock / 1000 + 10);

    await cached(token);
    clock += 11_000;
    await cached(token);
    expect(verify).toHaveBeenCalledTimes(2);
  });

  it('shares one verification between concurrent requests with the same token', async () => {
    let resolve!: (value: typeof user) => void;
    const verify = vi.fn(() => new Promise<typeof user>((done) => { resolve = done; }));
    const cached = createCachedTokenVerifier(verify);
    const token = jwt();
    const first = cached(token);
    const second = cached(token);
    resolve(user);
    expect(await Promise.all([first, second])).toEqual([user, user]);
    expect(verify).toHaveBeenCalledOnce();
  });

  it('keeps tokens of different users apart and evicts the oldest entry at capacity', async () => {
    const verify = vi.fn(async (token: string) => ({ ...user, id: token }));
    const cached = createCachedTokenVerifier(verify, { maxEntries: 1 });
    expect((await cached('a'))?.id).toBe('a');
    expect((await cached('b'))?.id).toBe('b');
    expect((await cached('a'))?.id).toBe('a');
    expect(verify).toHaveBeenCalledTimes(3);
  });

  it('propagates verifier errors without caching them', async () => {
    const verify = vi.fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(user);
    const cached = createCachedTokenVerifier(verify);
    await expect(cached('token')).rejects.toThrow('network');
    expect(await cached('token')).toEqual(user);
  });
});
