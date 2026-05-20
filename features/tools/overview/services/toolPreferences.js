import AsyncStorage from '@react-native-async-storage/async-storage';

const SELECTED_TOOLS_KEY = '@grow_selected_overview_tools';
const VIEW_MODE_KEY = '@grow_tools_overview_mode';
const PENDING_REPLACEMENT_TOOL_KEY = '@grow_pending_replacement_tool';

export async function getSelectedOverviewToolIds(defaultIds = []) {
  try {
    const raw = await AsyncStorage.getItem(SELECTED_TOOLS_KEY);
    if (!raw) return defaultIds;

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) return defaultIds;

    return parsed.slice(0, 6);
  } catch {
    return defaultIds;
  }
}

export async function saveSelectedOverviewToolIds(ids) {
  const cleanedIds = Array.isArray(ids) ? ids.slice(0, 6) : [];
  await AsyncStorage.setItem(SELECTED_TOOLS_KEY, JSON.stringify(cleanedIds));
}

export async function getToolsOverviewMode() {
  try {
    const raw = await AsyncStorage.getItem(VIEW_MODE_KEY);
    return raw === 'expanded' ? 'expanded' : 'compact';
  } catch {
    return 'compact';
  }
}

export async function saveToolsOverviewMode(mode) {
  await AsyncStorage.setItem(
    VIEW_MODE_KEY,
    mode === 'expanded' ? 'expanded' : 'compact'
  );
}

export async function setPendingReplacementToolId(toolId) {
  if (!toolId) return;
  await AsyncStorage.setItem(PENDING_REPLACEMENT_TOOL_KEY, toolId);
}

export async function getPendingReplacementToolId() {
  try {
    return await AsyncStorage.getItem(PENDING_REPLACEMENT_TOOL_KEY);
  } catch {
    return null;
  }
}

export async function clearPendingReplacementToolId() {
  await AsyncStorage.removeItem(PENDING_REPLACEMENT_TOOL_KEY);
}