import { useCallback, useEffect, useMemo, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';

import { tools } from '../../../../data/tools';

import {
  getSelectedOverviewToolIds,
  saveSelectedOverviewToolIds,
  getToolsOverviewMode,
  saveToolsOverviewMode,
  getPendingReplacementToolId,
  clearPendingReplacementToolId,
} from '../services/toolPreferences';

function getActiveTools() {
  return tools.filter((tool) => !tool.disabled && tool.route);
}

function buildPlaceholderSlots(count) {
  return Array.from({ length: count }).map((_, index) => ({
    id: `placeholder-${index}`,
    placeholder: true,
    title: 'In Bearbeitung',
  }));
}

export function useToolsOverviewPreferences() {
  const activeTools = useMemo(() => getActiveTools(), []);

  const defaultOverviewToolIds = useMemo(
    () => activeTools.slice(0, 6).map((tool) => tool.id),
    [activeTools]
  );

  const [overviewToolIds, setOverviewToolIds] = useState(defaultOverviewToolIds);
  const [toolsViewMode, setToolsViewMode] = useState('compact');
  const [reorderMode, setReorderMode] = useState(false);
  const [replacementToolId, setReplacementToolId] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function loadToolPreferences() {
      const savedIds = await getSelectedOverviewToolIds(defaultOverviewToolIds);
      const savedMode = await getToolsOverviewMode();

      const validIds = savedIds.filter((id) =>
        activeTools.some((tool) => tool.id === id)
      );

      const normalizedIds = validIds.length > 0
        ? validIds.slice(0, 6)
        : defaultOverviewToolIds;

      if (mounted) {
        setOverviewToolIds(normalizedIds);
        setToolsViewMode(savedMode);
      }
    }

    loadToolPreferences();

    return () => {
      mounted = false;
    };
  }, [activeTools, defaultOverviewToolIds]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function loadPendingReplacement() {
        const pendingId = await getPendingReplacementToolId();

        if (!active) return;

        if (!pendingId) {
          setReplacementToolId(null);
          return;
        }

        const validPendingTool = activeTools.find((tool) => tool.id === pendingId);

        if (!validPendingTool) {
          setReplacementToolId(null);
          await clearPendingReplacementToolId();
          return;
        }

        const currentIds = overviewToolIds.filter((id) =>
          activeTools.some((tool) => tool.id === id)
        );

        if (currentIds.includes(pendingId)) {
          setReplacementToolId(null);
          await clearPendingReplacementToolId();
          return;
        }

        setReplacementToolId(pendingId);
        setReorderMode(false);
        setToolsViewMode('compact');
      }

      loadPendingReplacement();

      return () => {
        active = false;
      };
    }, [activeTools, overviewToolIds])
  );

  const activeToolCount = activeTools.length;
  const canCustomizeOverviewTools = activeToolCount > 6;

  const normalizedOverviewToolIds = canCustomizeOverviewTools
    ? overviewToolIds
        .filter((id) => activeTools.some((tool) => tool.id === id))
        .slice(0, 6)
    : activeTools.slice(0, 6).map((tool) => tool.id);

  const overviewTools = normalizedOverviewToolIds
    .map((id) => activeTools.find((tool) => tool.id === id))
    .filter(Boolean);

  const visibleToolSlots = useMemo(() => {
    const expandedTools = activeTools.slice(0, 16);
    const missingExpandedSlots = Math.max(16 - expandedTools.length, 0);

    return [
      ...expandedTools,
      ...buildPlaceholderSlots(missingExpandedSlots),
    ];
  }, [activeTools]);

  const isExpandedTools = toolsViewMode === 'expanded';

  const replacementTool = replacementToolId
    ? activeTools.find((tool) => tool.id === replacementToolId)
    : null;

  const handleSetToolsViewMode = async (nextMode) => {
    if (nextMode === toolsViewMode) return;

    setReorderMode(false);
    setToolsViewMode(nextMode);
    await saveToolsOverviewMode(nextMode);
  };

  const handleToggleToolsViewMode = () => {
    const nextMode = toolsViewMode === 'expanded' ? 'compact' : 'expanded';
    handleSetToolsViewMode(nextMode);
  };

  const handleReplaceOverviewTool = async (targetTool) => {
    if (!replacementToolId || !targetTool || targetTool.placeholder || targetTool.disabled) {
      return;
    }

    const replacement = activeTools.find((tool) => tool.id === replacementToolId);

    if (!replacement) {
      setReplacementToolId(null);
      await clearPendingReplacementToolId();
      return;
    }

    const currentIds = normalizedOverviewToolIds.slice(0, 6);
    const targetIndex = currentIds.indexOf(targetTool.id);

    if (targetIndex === -1) {
      return;
    }

    if (currentIds.includes(replacementToolId)) {
      setReplacementToolId(null);
      await clearPendingReplacementToolId();
      return;
    }

    const nextIds = [...currentIds];
    nextIds[targetIndex] = replacementToolId;

    setOverviewToolIds(nextIds);
    await saveSelectedOverviewToolIds(nextIds);

    setReplacementToolId(null);
    await clearPendingReplacementToolId();
  };

  const handleCancelReplacement = async () => {
    setReplacementToolId(null);
    await clearPendingReplacementToolId();
  };

  const handleReorderOverviewTools = async (reorderedTools) => {
    const nextIds = reorderedTools
      .filter((tool) => !tool.disabled && !tool.placeholder && tool.route)
      .map((tool) => tool.id)
      .slice(0, 6);

    if (nextIds.length === 0) return;

    setOverviewToolIds(nextIds);
    await saveSelectedOverviewToolIds(nextIds);
  };

  const handleToolPress = (tool) => {
    if (!tool || tool.placeholder || tool.disabled) {
      return;
    }

    if (replacementToolId) {
      handleReplaceOverviewTool(tool);
      return;
    }

    if (reorderMode) {
      return;
    }

    if (tool.route) {
      router.push(tool.route);
    }
  };

  const handleScreenPress = async (onCloseMenu) => {
    onCloseMenu?.();

    if (reorderMode) {
      setReorderMode(false);
      return;
    }

    if (replacementToolId) {
      setReplacementToolId(null);
      await clearPendingReplacementToolId();
    }
  };

  return {
    activeTools,
    overviewToolIds,
    toolsViewMode,
    reorderMode,
    replacementToolId,

    overviewTools,
    visibleToolSlots,
    isExpandedTools,
    replacementTool,

    setReorderMode,

    handleSetToolsViewMode,
    handleToggleToolsViewMode,
    handleCancelReplacement,
    handleReorderOverviewTools,
    handleToolPress,
    handleScreenPress,
  };
}