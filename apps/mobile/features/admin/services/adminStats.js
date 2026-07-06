import { supabase } from '../../../services/supabaseClient';

export async function loadAdminOverviewStats() {
  const [overviewResult, toolAnalyticsResult] = await Promise.allSettled([
    supabase.rpc('get_admin_overview_stats'),
    supabase.rpc('get_admin_tool_analytics', { limit_count: 1000 }),
  ]);

  if (overviewResult.status === 'rejected') {
    throw overviewResult.reason;
  }

  const { data, error } = overviewResult.value;

  if (error) {
    throw error;
  }

  const stats = Array.isArray(data) ? data[0] : data;
  const toolRows =
    toolAnalyticsResult.status === 'fulfilled' && !toolAnalyticsResult.value.error
      ? toolAnalyticsResult.value.data ?? []
      : [];

  const aggregatedToolTotals = toolRows.reduce(
    (acc, item) => {
      acc.opens += Number(item.opens_count ?? 0);
      acc.seconds += Number(item.total_seconds ?? 0);
      return acc;
    },
    { opens: 0, seconds: 0 }
  );

  const toolTotals = toolRows.length > 0
    ? aggregatedToolTotals
    : {
        opens: Number(stats?.total_tool_opens ?? 0),
        seconds: Number(stats?.total_tool_seconds ?? 0),
      };

  return {
    totalUsers: Number(stats?.total_users ?? 0),
    totalFeedbacks: Number(stats?.total_feedbacks ?? 0),
    totalViews: Number(stats?.total_views ?? 0),
    totalSaves: Number(stats?.total_saves ?? 0),
    totalRatings: Number(stats?.total_ratings ?? 0),
    totalToolOpens: toolTotals.opens,
    totalToolSeconds: toolTotals.seconds,
    usedBetaCodes: Number(stats?.used_beta_codes ?? 0),
    openBetaCodes: Number(stats?.open_beta_codes ?? 0),
    totalBetaCodes: Number(stats?.total_beta_codes ?? 0),
  };
}
