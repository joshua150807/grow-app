import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { createUsernameLoginService } from '../src/modules/usernameLogin/usernameLoginService.js';
import { createUsernameLoginLimiter } from '../src/routes/v1/usernameLogin.js';

describe('compatible username login', () => {
  it('is absent by default, preserving the existing API', async () => {
    const app = buildApp({ usernameLoginEnabled: false });
    try { expect((await app.inject({ method: 'POST', url: '/v1/auth/username-login', payload: {} })).statusCode).toBe(404); }
    finally { await app.close(); }
  });
  it('returns only tokens after valid credentials, normalizes username and keeps passwords exact', async () => {
    const calls: unknown[] = [];
    const service = createUsernameLoginService({
      resolveEmail: async username => { calls.push(username); return 'private@example.invalid'; },
      signIn: async (email, password) => { calls.push({ email, password }); return { access_token: 'access', refresh_token: 'refresh' }; },
    });
    const app = buildApp({ usernameLoginEnabled: true, usernameLoginService: service });
    try {
      const result = await app.inject({ method: 'POST', url: '/v1/auth/username-login', payload: { username: '  Grower ', password: ' exact ' } });
      expect(result.statusCode).toBe(200);
      expect(result.headers['cache-control']).toBe('no-store');
      expect(result.json()).toEqual({ access_token: 'access', refresh_token: 'refresh' });
      expect(result.body).not.toContain('private@');
      expect(calls).toEqual(['grower', { email: 'private@example.invalid', password: ' exact ' }]);
    } finally { await app.close(); }
  });
  it('gives identical errors for unknown usernames and wrong passwords; retains legacy email fallback', async () => {
    const attempts: string[] = [];
    const run = (email: string | null) => createUsernameLoginService({ resolveEmail: async () => email,
      signIn: async value => { attempts.push(value); return null; } }).login({ username: 'grower', password: 'bad' });
    await expect(run(null)).rejects.toMatchObject({ statusCode: 401, message: 'Username or password is incorrect.' });
    await expect(run('private@example.invalid')).rejects.toMatchObject({ statusCode: 401, message: 'Username or password is incorrect.' });
    expect(attempts).toEqual(['grower@growapp.com', 'private@example.invalid']);
  });
  it('suppresses sensitive provider failures', async () => {
    const service = createUsernameLoginService({ resolveEmail: async () => { throw new Error('private@example.invalid'); }, signIn: async () => null });
    await expect(service.login({ username: 'grower', password: 'bad' })).rejects.toMatchObject({ statusCode: 503, message: 'Login temporarily unavailable.' });
  });
  it('strictly validates input before account lookup', async () => {
    let lookups = 0;
    const service = createUsernameLoginService({ resolveEmail: async () => { lookups++; return null; }, signIn: async () => null });
    for (const input of [{ username: '', password: 'x' }, { username: 'a', password: '' }, { username: 'a', password: 'x', email: 'extra' }]) {
      await expect(service.login(input)).rejects.toThrow();
    }
    expect(lookups).toBe(0);
  });
  it('limits normalized usernames even with spoofed forwarding headers', async () => {
    let calls = 0;
    const app = buildApp({ usernameLoginEnabled: true, usernameLoginService: { login: async () => { calls++; return { access_token: 'a', refresh_token: 'r' }; } } });
    try {
      for (let i = 0; i < 6; i++) {
        const response = await app.inject({ method: 'POST', url: '/v1/auth/username-login', headers: { 'x-forwarded-for': `192.0.2.${i}` }, payload: { username: i % 2 ? ' grower ' : 'GROWER', password: 'x' } });
        expect(response.statusCode).toBe(i < 5 ? 200 : 429);
      }
      expect(calls).toBe(5);
    } finally { await app.close(); }
  });
  it('expires rate windows and limits requests across usernames for the same network peer', () => {
    let time = 0;
    const limit = createUsernameLoginLimiter(() => time);
    for (let i = 0; i < 60; i++) limit('peer', `user-${i}`);
    expect(() => limit('peer', 'another')).toThrow();
    time = 300_001;
    expect(() => limit('peer', 'another')).not.toThrow();
  });
});
