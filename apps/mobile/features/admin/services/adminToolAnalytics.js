import { supabase } from '../../../services/supabaseClient';

function toNumber(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

export async function loadAdminToolAnalyticsOverview(limit = 500) {
  const { data, error } = await supabase.rpc('get_admin_tool_analytics_overview', {
    limit_count: limit,
  });

  if (error) {
    throw error;
  }

  return (data ?? []).map((item) => ({
    id: item.tool_id,
    toolId: item.tool_id,
    toolTitle: item.tool_title ?? item.tool_id ?? 'Unbekanntes Tool',
    opensCount: toNumber(item.opens_count),
    totalSeconds: toNumber(item.total_seconds),
    averageSeconds: toNumber(item.average_seconds),
    usersCount: toNumber(item.users_count),
    lastOpenedAt: item.last_opened_at ?? null,
  }));
}

export async function loadAdminToolAnalyticsUsers(toolId, limit = 500) {
  if (!toolId) return [];

  const { data, error } = await supabase.rpc('get_admin_tool_analytics_users', {
    selected_tool_id: toolId,
    limit_count: limit,
  });

  if (error) {
    throw error;
  }

  return (data ?? []).map((item) => ({
    id: `${item.user_id}-${item.tool_id}`,
    userId: item.user_id,
    username: item.username ?? 'Unbekannter User',
    email: item.email ?? null,
    toolId: item.tool_id,
    toolTitle: item.tool_title ?? item.tool_id ?? 'Unbekanntes Tool',
    opensCount: toNumber(item.opens_count),
    totalSeconds: toNumber(item.total_seconds),
    averageSeconds: toNumber(item.average_seconds),
    lastOpenedAt: item.last_opened_at ?? null,
  }));
}

export async function loadAdminToolAnalytics(limit = 500) {
  return loadAdminToolAnalyticsOverview(limit);
}
