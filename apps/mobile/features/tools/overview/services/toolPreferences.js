import { logger } from '../../../../lib/logger';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SELECTED_TOOLS_KEY = '@grow_selected_overview_tools';
const VIEW_MODE_KEY = '@grow_tools_overview_mode';
const PENDING_REPLACEMENT_TOOL_KEY = '@grow_pending_replacement_tool';

function normalizeToolIds(ids, fallbackIds = []) {
  const source = Array.isArray(ids) ? ids : fallbackIds;
  const uniqueIds = [];

  source.forEach((id) => {
    if (typeof id !== 'string' || !id.trim()) return;
    if (uniqueIds.includes(id)) return;

    uniqueIds.push(id);
  });

  return uniqueIds.slice(0, 6);
}

export async function getSelectedOverviewToolIds(defaultIds = []) {
  try {
    const raw = await AsyncStorage.getItem(SELECTED_TOOLS_KEY);
    if (!raw) return normalizeToolIds(defaultIds);

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) return normalizeToolIds(defaultIds);

    return normalizeToolIds(parsed, defaultIds);
  } catch (error) {
    logger.debug('[ToolPreferences] Failed to read selected tools:', error);
    return normalizeToolIds(defaultIds);
  }
}

export async function saveSelectedOverviewToolIds(ids) {
  try {
    const cleanedIds = normalizeToolIds(ids);
    await AsyncStorage.setItem(SELECTED_TOOLS_KEY, JSON.stringify(cleanedIds));
    return true;
  } catch (error) {
    logger.debug('[ToolPreferences] Failed to save selected tools:', error);
    return false;
  }
}

export async function getToolsOverviewMode() {
  try {
    const raw = await AsyncStorage.getItem(VIEW_MODE_KEY);
    return raw === 'expanded' ? 'expanded' : 'compact';
  } catch (error) {
    logger.debug('[ToolPreferences] Failed to read overview mode:', error);
    return 'compact';
  }
}

export async function saveToolsOverviewMode(mode) {
  try {
    await AsyncStorage.setItem(
      VIEW_MODE_KEY,
      mode === 'expanded' ? 'expanded' : 'compact'
    );
    return true;
  } catch (error) {
    logger.debug('[ToolPreferences] Failed to save overview mode:', error);
    return false;
  }
}

export async function setPendingReplacementToolId(toolId) {
  try {
    if (!toolId || typeof toolId !== 'string') return false;

    await AsyncStorage.setItem(PENDING_REPLACEMENT_TOOL_KEY, toolId);
    return true;
  } catch (error) {
    logger.debug('[ToolPreferences] Failed to set pending replacement:', error);
    return false;
  }
}

export async function getPendingReplacementToolId() {
  try {
    return await AsyncStorage.getItem(PENDING_REPLACEMENT_TOOL_KEY);
  } catch (error) {
    logger.debug('[ToolPreferences] Failed to read pending replacement:', error);
    return null;
  }
}

export async function clearPendingReplacementToolId() {
  try {
    await AsyncStorage.removeItem(PENDING_REPLACEMENT_TOOL_KEY);
    return true;
  } catch (error) {
    logger.debug('[ToolPreferences] Failed to clear pending replacement:', error);
    return false;
  }
}
