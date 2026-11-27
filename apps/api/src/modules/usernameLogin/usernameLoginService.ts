import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { config } from '../../config/index.js';
import { getPgPool } from '../../db/client.js';
import { AppError } from '../../errors/appError.js';

export const usernameLoginInputSchema = z.object({
  username: z.string().trim().toLowerCase().min(1).max(120),
  password: z.string().min(1).max(1024),
}).strict();
export const usernameLoginSessionSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
}).strict();
type LoginSession = z.infer<typeof usernameLoginSessionSchema>;
export type UsernameLoginService = { login(input: unknown): Promise<LoginSession> };
type Dependencies = {
  resolveEmail(username: string): Promise<string | null>;
  signIn(email: string, password: string): Promise<LoginSession | null>;
};

export function createUsernameLoginService(deps?: Dependencies): UsernameLoginService {
  const runtime: Dependencies = deps ?? {
    async resolveEmail(username) {
      // Preserve the existing username mapping, including old account conventions.
      // The resolved email never leaves the backend before password verification.
      const result = await getPgPool().query<{ email: string | null }>(
        'select public.get_auth_email_for_username($1) as email', [username],
      );
      return result.rows[0]?.email ?? null;
    },
    async signIn(email, password) {
      if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) throw new Error('Auth unavailable');
      // Never share mutable sign-in state across concurrent users.
      const client = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(10_000) }) },
      });
      const result = await client.auth.signInWithPassword({ email, password });
      if (result.error || !result.data.session) return null;
      return {
        access_token: result.data.session.access_token,
        refresh_token: result.data.session.refresh_token,
      };
    },
  };
  return {
    async login(input) {
      const { username, password } = usernameLoginInputSchema.parse(input);
      let session: LoginSession | null;
      try {
        const email = await runtime.resolveEmail(username);
        // Same fallback as Build 42. Unknown usernames still go through Auth.
        session = await runtime.signIn(email || `${username}@growapp.com`, password);
      } catch {
        // Do not propagate provider/DB errors containing account information.
        throw new AppError(503, 'INTERNAL_ERROR', 'Login temporarily unavailable.');
      }
      if (!session) throw new AppError(401, 'UNAUTHORIZED', 'Username or password is incorrect.');
      return usernameLoginSessionSchema.parse(session);
    },
  };
}
