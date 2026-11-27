import type { FastifyServerOptions } from 'fastify';
import type { AppConfig } from '../config/index.js';

export function createLoggerOptions(config: AppConfig): FastifyServerOptions['logger'] {
  if (config.NODE_ENV === 'test') {
    return false;
  }

  return {
    level: config.LOG_LEVEL,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.body.password',
        'body.password',
        'password',
        'access_token',
        'refresh_token',
        'SUPABASE_SERVICE_ROLE_KEY',
        'SUPABASE_JWT_SECRET',
      ],
      remove: true,
    },
  };
}
