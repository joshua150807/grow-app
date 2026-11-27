import 'dotenv/config';
import { z } from 'zod';

const nodeEnvSchema = z.enum(['development', 'test', 'production']).default('development');

const envSchema = z.object({
  NODE_ENV: nodeEnvSchema,
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().max(65535).default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  SUPABASE_URL: z.string().url().optional().or(z.literal('')),
  SUPABASE_ANON_KEY: z.string().min(1).optional().or(z.literal('')),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional().or(z.literal('')),
  SUPABASE_JWT_SECRET: z.string().min(1).optional().or(z.literal('')),
  MENTOR_ENABLED: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  MENTOR_PROVIDER: z.enum(['mock']).default('mock'),
  MENTOR_PROVIDER_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(30000),
  MENTOR_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(64).max(8192).default(1024),
  MENTOR_HISTORY_MESSAGES: z.coerce.number().int().min(2).max(100).default(20),
  MENTOR_DAILY_MESSAGE_LIMIT: z.coerce.number().int().min(1).max(1000).default(30),
  MENTOR_BURST_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).max(120).default(6),
  MENTOR_QUOTA_TIME_ZONE: z.string().min(1).refine((value) => {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, 'Invalid IANA time zone.').default('Europe/Berlin'),
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return envSchema.parse(env);
}

export const config = loadConfig();
