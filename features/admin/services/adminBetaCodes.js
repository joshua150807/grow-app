import { supabase } from '../../../services/supabaseClient';

export async function loadAdminBetaCodes(limit = 500) {
  const { data, error } = await supabase.rpc('get_admin_beta_codes', {
    limit_count: limit,
  });

  if (error) {
    throw error;
  }

  return (data ?? []).map((item, index) => ({
    id: item.code_id ?? `${item.code}-${index}`,
    code: item.code ?? 'Unbekannter Code',
    usedBy: item.used_by ?? null,
    usedAt: item.used_at ?? null,
    username: item.username ?? null,
    isUsed: Boolean(item.used_by || item.used_at),
  }));
}