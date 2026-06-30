import fp from 'fastify-plugin';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../errors/appError.js';
import { bearerTokenSchema } from '../validation/schemas.js';

export type AuthUser = {
  id: string;
  role: 'user' | 'creator' | 'admin' | 'ceo';
};

declare module 'fastify' {
  interface FastifyRequest {
    auth: {
      token: string | null;
      user: AuthUser | null;
    };
  }
}

function getBearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header) return null;

  const parsed = bearerTokenSchema.safeParse(header);
  if (!parsed.success) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid authorization header.');
  }

  return parsed.data.replace(/^Bearer\s+/i, '');
}

async function decorateAuth(request: FastifyRequest) {
  const token = getBearerToken(request);

  request.auth = {
    token,
    user: null,
  };
}

export const authPlugin = fp(async (app) => {
  app.addHook('onRequest', decorateAuth);

  app.decorate('requireAuth', async (request: FastifyRequest, _reply: FastifyReply) => {
    if (!request.auth.token) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication is required.');
    }

    // Placeholder: later this will verify the Supabase JWT and load the auth user.
    throw new AppError(501, 'INTERNAL_ERROR', 'Supabase JWT verification is not implemented yet.');
  });
});

declare module 'fastify' {
  interface FastifyInstance {
    requireAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
