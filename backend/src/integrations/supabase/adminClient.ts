import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';

let cachedClient: SupabaseClient | null = null;

export function getSupabaseAdminClient(): SupabaseClient {
  if (cachedClient) {
    return cachedClient;
  }

  if (!config.SUPABASE_URL || !config.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase admin client is not configured.');
  }

  cachedClient = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return cachedClient;
}
