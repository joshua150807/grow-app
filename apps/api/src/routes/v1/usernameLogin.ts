import { createHash } from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';
import { AppError } from '../../errors/appError.js';
import {
  createUsernameLoginService, usernameLoginInputSchema, type UsernameLoginService,
} from '../../modules/usernameLogin/usernameLoginService.js';

// Single-instance defence. A shared edge limit is a deployment prerequisite
// before adding replicas. Never trust client-supplied forwarding headers.
export function createUsernameLoginLimiter(now = Date.now) {
  const buckets = new Map<string, { count: number; until: number }>();
  const windowMs = 5 * 60 * 1000;
  return (ip: string, username: string) => {
    const time = now();
    for (const [key, bucket] of buckets) if (bucket.until <= time) buckets.delete(key);
    const keys = [
      { key: `ip:${ip}`, limit: 60 },
      { key: `name:${createHash('sha256').update(username).digest('hex')}`, limit: 5 },
    ];
    if (buckets.size + keys.filter(k => !buckets.has(k.key)).length > 2000
      || keys.some(k => (buckets.get(k.key)?.count ?? 0) >= k.limit)) {
      throw new AppError(429, 'UNAUTHORIZED', 'Too many login attempts. Please try again later.');
    }
    for (const { key } of keys) {
      const bucket = buckets.get(key) ?? { count: 0, until: time + windowMs };
      bucket.count++; buckets.set(key, bucket);
    }
  };
}

export const usernameLoginRoutes: FastifyPluginAsync<{
  enabled: boolean; service?: UsernameLoginService;
}> = async (app, options) => {
  if (!options.enabled) return;
  let service: UsernameLoginService | undefined = options.service;
  const limit = createUsernameLoginLimiter();
  app.post('/auth/username-login', { bodyLimit: 4096 }, async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    const input = usernameLoginInputSchema.parse(request.body);
    limit(request.ip, input.username);
    service ??= createUsernameLoginService();
    return service.login(input);
  });
};
