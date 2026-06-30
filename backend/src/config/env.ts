import 'dotenv/config';
import { z } from 'zod';

const nodeEnvSchema = z.enum(['development', 'test', 'production']).default('development');

const envSchema = z.object({
  NODE_ENV: nodeEnvSchema,
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().max(65535).default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  SUPABASE_URL: z.string().url().optional().or(z.literal('')),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional().or(z.literal('')),
  SUPABASE_JWT_SECRET: z.string().min(1).optional().or(z.literal('')),
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return envSchema.parse(env);
}

export const config = loadConfig();
