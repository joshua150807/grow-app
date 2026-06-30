import fp from 'fastify-plugin';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { verifySupabaseAccessToken } from '../auth/supabaseAuth.js';
import type { AuthTokenVerifier, AuthUser } from '../auth/types.js';
import { AppError } from '../errors/appError.js';
import { bearerTokenSchema } from '../validation/schemas.js';

type AuthPluginOptions = {
  verifyToken?: AuthTokenVerifier;
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

export const authPlugin = fp<AuthPluginOptions>(async (app, options) => {
  const verifyToken = options.verifyToken ?? verifySupabaseAccessToken;

  app.addHook('onRequest', decorateAuth);

  app.decorate('requireAuth', async (request: FastifyRequest, _reply: FastifyReply) => {
    if (!request.auth.token) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication is required.');
    }

    const user = await verifyToken(request.auth.token);

    if (!user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Invalid or expired access token.');
    }

    request.auth.user = user;
  });
});

declare module 'fastify' {
  interface FastifyInstance {
    requireAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
