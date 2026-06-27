import { logger } from '../../../../lib/logger';
import { tools } from '../../../../data/tools';
import { supabase } from '../../../../services/supabaseClient';

const MIN_DURATION_SECONDS = 2;

function normalizePath(pathname) {
  if (!pathname || typeof pathname !== 'string') return '';

  return pathname.split('?')[0].replace(/\/$/, '');
}

export function getTrackedToolForPath(pathname) {
  const normalizedPath = normalizePath(pathname);

  if (!normalizedPath) return null;

  return tools.find((tool) => {
    if (!tool?.route || tool.disabled) return false;

    const route = normalizePath(tool.route);

    if (normalizedPath === route) return true;

    // Unterseiten den Haupttools zuordnen, z. B. /tools/notes/new -> Notizen.
    if (route === '/tools/notes' && normalizedPath.startsWith('/tools/notes/')) {
      return true;
    }

    if (route === '/tools/training-plan' && normalizedPath.startsWith('/tools/training')) {
      return true;
    }

    if (route === '/tools/leitfragen' && normalizedPath.startsWith('/tools/leitfragen/')) {
      return true;
    }

    return false;
  }) ?? null;
}

async function getUserId() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.id) {
    return null;
  }

  return user.id;
}

export async function trackToolOpen(tool) {
  if (!tool?.id) return;

  try {
    const userId = await getUserId();

    if (!userId) return;

    const { error } = await supabase.from('tool_usage_events').insert({
      user_id: userId,
      tool_id: tool.id,
      tool_title: tool.title ?? tool.id,
      event_type: 'open',
      duration_seconds: 0,
    });

    if (error) {
      logger.debug('[ToolAnalytics] open event failed:', error);
    }
  } catch (error) {
    logger.debug('[ToolAnalytics] open event failed:', error);
  }
}

export async function trackToolDuration(tool, durationSeconds) {
  const seconds = Math.round(Number(durationSeconds ?? 0));

  if (!tool?.id || !Number.isFinite(seconds) || seconds < MIN_DURATION_SECONDS) {
    return;
  }

  try {
    const userId = await getUserId();

    if (!userId) return;

    const { error } = await supabase.from('tool_usage_events').insert({
      user_id: userId,
      tool_id: tool.id,
      tool_title: tool.title ?? tool.id,
      event_type: 'duration',
      duration_seconds: seconds,
    });

    if (error) {
      logger.debug('[ToolAnalytics] duration event failed:', error);
    }
  } catch (error) {
    logger.debug('[ToolAnalytics] duration event failed:', error);
  }
}
