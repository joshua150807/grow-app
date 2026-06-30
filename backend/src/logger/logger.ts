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
        'SUPABASE_SERVICE_ROLE_KEY',
        'SUPABASE_JWT_SECRET',
      ],
      remove: true,
    },
  };
}
