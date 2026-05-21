import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  ImageBackground,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';

// data
import { tools } from '../../../../data/tools';

// constants
import { COLORS } from '../../../../constants/colors';
import { s, sv, SCREEN } from '../../../../constants/layout';

// services / hooks aus anderen tools
import { getHabitStreak, getTodayHabitProgress } from '../../habits/services/habits';
import { getTodayDeepWorkSeconds } from '../../deep-work/services/deepWorkStore';
import { useSteps } from '../../../steps/hooks/useSteps';
import { useProfile } from '../.././../profile/hooks/useProfile';
import { supabase } from '../../../../services/supabaseClient';

import {
  getSelectedOverviewToolIds,
  saveSelectedOverviewToolIds,
  getToolsOverviewMode,
  saveToolsOverviewMode,
  getPendingReplacementToolId,
  clearPendingReplacementToolId,
} from '../services/toolPreferences';

// eigene components
import ToolCard from '../components/ToolCard';
import TrackerBox from '../components/Trackerbox';
import DraggableSixToolGrid from '../components/DraggableSixToolGrid';
import AnimatedToolsGridSwitcher from '../components/AnimatedToolsGridSwitcher';

// styles
import { styles } from '../styles/toolsOverviewStyles';

import { MENTOR_BG } from '../../../../constants/toolAssets';

const GROW_AVATAR = require('../../../../assets/images/grow_avatar.png');

function formatDeepWork(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const sec = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

function formatSteps(count) {
  if (count >= 1000) {
    return `${Math.floor(count / 1000)}.${String(count % 1000).padStart(3, '0')}`;
  }

  return String(count);
}

function renderToolIcon(tool) {
  const iconColor = tool.disabled ? COLORS.toolsTextDim : COLORS.toolsGold;

  if (tool.type === 'Ionicons') {
    return <Ionicons name={tool.name} size={s(20)} color={iconColor} />;
  }

  if (tool.type === 'MaterialCommunityIcons') {
    return <MaterialCommunityIcons name={tool.name} size={s(20)} color={iconColor} />;
  }

  if (tool.type === 'Feather') {
    return <Feather name={tool.name} size={s(20)} color={iconColor} />;
  }

  return null;
}

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

export default function ToolsScreen() {
  const { height, width } = useWindowDimensions();

  const runtimeVeryCompact = height < 760;
  const runtimeCompact = height < 900;

  const horizontalPadding = s(14) * 2;
  const gridWidth = width - horizontalPadding;
  const cardWidth = gridWidth * 0.315;

  const topPaddingReserve = runtimeVeryCompact ? sv(44) : runtimeCompact ? sv(50) : sv(62);
  const bottomPaddingReserve = runtimeVeryCompact ? sv(48) : runtimeCompact ? sv(56) : sv(68);

  const headerReserve = runtimeVeryCompact ? sv(54) : runtimeCompact ? sv(60) : sv(70);
  const titleReserve = runtimeVeryCompact ? sv(38) : runtimeCompact ? sv(42) : sv(48);

  const activeToolsReserve =
    cardWidth * 2 +
    (runtimeVeryCompact ? sv(10) : runtimeCompact ? sv(12) : sv(16));

  const mentorBannerHeight = Math.max(
    runtimeVeryCompact ? sv(84) : sv(98),
    Math.min(height * 0.12, runtimeCompact ? sv(116) : sv(128))
  );

  const trackerReserveHeight = Math.max(
    runtimeVeryCompact ? sv(98) : sv(112),
    Math.min(height * 0.13, runtimeCompact ? sv(128) : sv(140))
  );

  const fixedContentHeight =
    topPaddingReserve +
    bottomPaddingReserve +
    headerReserve +
    titleReserve +
    activeToolsReserve +
    mentorBannerHeight +
    trackerReserveHeight;

  const availableComingSoonHeight = height - fixedContentHeight;

  const comingSoonCardHeight = Math.max(
    runtimeVeryCompact ? sv(54) : runtimeCompact ? sv(66) : sv(78),
    Math.min(availableComingSoonHeight, cardWidth)
  );

  const { username, growPoints, isCeo } = useProfile();

  const activeTools = useMemo(() => getActiveTools(), []);

  const defaultOverviewToolIds = useMemo(
    () => activeTools.slice(0, 6).map((tool) => tool.id),
    [activeTools]
  );

  const [menuOpen, setMenuOpen] = useState(false);

  const [overviewToolIds, setOverviewToolIds] = useState(defaultOverviewToolIds);
  const [toolsViewMode, setToolsViewMode] = useState('compact');
  const [reorderMode, setReorderMode] = useState(false);
  const [replacementToolId, setReplacementToolId] = useState(null);

  const [streak, setStreak] = useState(0);
  const [habitProgress, setHabitProgress] = useState({ completed: 0, total: 0 });
  const [deepWorkTime, setDeepWorkTime] = useState(0);

  const steps = useSteps();

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

  useEffect(() => {
    getHabitStreak().then(setStreak).catch(() => {});
    getTodayHabitProgress().then(setHabitProgress).catch(() => {});
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadDeepWorkToday() {
      const seconds = await getTodayDeepWorkSeconds();
      if (mounted) setDeepWorkTime(seconds);
    }

    loadDeepWorkToday();

    const interval = setInterval(loadDeepWorkToday, 5000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

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

  const expandedToolSlots = useMemo(() => {
    const expandedTools = activeTools.slice(0, 16);
    const missingExpandedSlots = Math.max(16 - expandedTools.length, 0);

    return [
      ...expandedTools,
      ...buildPlaceholderSlots(missingExpandedSlots),
    ];
  }, [activeTools]);

  const visibleToolSlots = expandedToolSlots;

  const isExpandedTools = toolsViewMode === 'expanded';

  const replacementTool = replacementToolId
    ? activeTools.find((tool) => tool.id === replacementToolId)
    : null;

  const habitPercent = habitProgress.total === 0
    ? '–'
    : `${Math.round((habitProgress.completed / habitProgress.total) * 100)}%`;

  const trackerItems = [
    { value: String(streak), label: 'Tage Streak' },
    { value: habitPercent, label: 'Tagesziele' },
    { value: deepWorkTime > 0 ? formatDeepWork(deepWorkTime) : '00:00', label: 'Deep Work' },
    { value: formatSteps(steps), label: 'Schritte' },
  ];

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace('/(auth)/login');
  }

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

  const handleScreenPress = async () => {
    setMenuOpen(false);

    if (reorderMode) {
      setReorderMode(false);
      return;
    }

    if (replacementToolId) {
      setReplacementToolId(null);
      await clearPendingReplacementToolId();
    }
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

  return (
    <Pressable onPress={handleScreenPress} style={styles.screen}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.leftHeader}>
            <View style={styles.avatar}>
              <View style={styles.avatarImageClip}>
                <Image
                  source={GROW_AVATAR}
                  style={styles.avatarImage}
                  resizeMode="cover"
                />
              </View>
            </View>

            <View style={styles.headerTextBox}>
              <Text style={styles.topLabel}>GROW</Text>
              <Text style={styles.accountName}>{username}</Text>
            </View>
          </View>

          <View style={styles.rightHeader}>
            <View style={styles.pointsBox}>
              <View style={styles.pointsRow}>
                <View style={styles.coinPlaceholder}>
                  <Text style={styles.coinStar}>★</Text>
                </View>

                <Text style={styles.pointsValue}>
                  {growPoints.toLocaleString('de-DE')}
                </Text>
              </View>

              <Text style={styles.pointsLabel}>GROW Points</Text>
            </View>

            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                setMenuOpen((p) => !p);
              }}
              style={styles.menuButton}
            >
              <Feather name="more-vertical" size={s(20)} color={COLORS.softGold} />
            </Pressable>

            {menuOpen && (
              <Pressable style={styles.dropdown} onPress={(e) => e.stopPropagation()}>
                <Pressable onPress={() => router.push('/tools/saved-videos')}>
                  <Text style={styles.menuItem}>Gespeicherte Videos</Text>
                </Pressable>

                <Pressable onPress={() => router.push('/tools/privacy')}>
                  <Text style={styles.menuItem}>Datenschutz</Text>
                </Pressable>

                <Pressable onPress={() => router.push('/tools/imprint')}>
                  <Text style={styles.menuItem}>Impressum</Text>
                </Pressable>

                {isCeo && (
                  <Pressable onPress={() => router.push('/admin-dashboard')}>
                    <Text style={styles.menuItem}>CEO Dashboard</Text>
                  </Pressable>
                )}

                <View style={styles.line} />

                <Pressable onPress={handleLogout}>
                  <Text style={styles.logoutItem}>Logout</Text>
                </Pressable>
              </Pressable>
            )}
          </View>
        </View>

        {/* Tools Header */}
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionHeaderSpacer} />

          <Text style={styles.sectionTitle}>TOOLS</Text>

          <View style={styles.sectionActions}>
            <Pressable
              style={styles.sectionSmallButton}
              onPress={handleToggleToolsViewMode}
              hitSlop={8}
            >
              <Text style={styles.sectionSmallButtonText}>
                {isExpandedTools ? '2x3' : '4x4'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Ersetzen-Modus */}
        {replacementToolId && (
          <View style={styles.replacePanel}>
            <Text style={styles.replacePanelTitle}>Tool ersetzen</Text>

            <Text style={styles.replacePanelText}>
              {replacementTool
                ? `Wähle ein Tool aus, das durch „${replacementTool.title}“ ersetzt werden soll.`
                : 'Wähle ein Tool aus, das ersetzt werden soll.'}
            </Text>

            <Pressable
              style={styles.replaceCancelButton}
              onPress={handleCancelReplacement}
            >
              <Text style={styles.replaceCancelText}>Abbrechen</Text>
            </Pressable>
          </View>
        )}

        {/* Reorder-Modus */}
        {reorderMode && !replacementToolId && !isExpandedTools && (
          <View style={styles.editPanel}>
            <Text style={styles.editPanelTitle}>Tools verschieben</Text>

            <Text style={styles.editPanelText}>
              Ziehe Tools an eine andere Position. Tippe auf Fertig, wenn die Reihenfolge passt.
            </Text>

            <Pressable
              style={styles.editDoneButton}
              onPress={() => setReorderMode(false)}
            >
              <Text style={styles.editDoneText}>Fertig</Text>
            </Pressable>
          </View>
        )}

        {/* Tools Grid */}
        <AnimatedToolsGridSwitcher
          mode={toolsViewMode}
          overviewTools={overviewTools}
          visibleToolSlots={visibleToolSlots}
          replacementToolId={replacementToolId}
          reorderMode={reorderMode}
          overviewToolIds={overviewToolIds}
          overviewStyles={styles}
          renderToolIcon={renderToolIcon}
          onToolPress={handleToolPress}
          onReorder={handleReorderOverviewTools}
          onReorderModeChange={setReorderMode}
          onExitReorderMode={() => setReorderMode(false)}
          onModeChange={handleSetToolsViewMode}
          onOpenAllTools={() => router.push('/tools/all-tools')}
        />

        {/* Weitere Tools nur in 2x3 Ansicht und nicht im Reorder-Modus */}

        {/* KI Mentor Card */}
        <ImageBackground
          source={MENTOR_BG}
          style={[styles.mentorCard, { height: mentorBannerHeight }]}
          imageStyle={styles.mentorCardImage}
          resizeMode="stretch"
        >
          <View style={styles.mentorOverlay}>
            <View style={styles.mentorLeft}>
              <View style={styles.mentorTextBox}>
                <Text style={styles.mentorTitle}>KI Mentor</Text>
                <Text style={styles.mentorDescription}>
                  Dein persönlicher Mentor. Klare Tipps & Motivation.
                </Text>
              </View>
            </View>

            <Pressable
              style={styles.mentorButton}
              onPress={() => router.push('/mentor')}
            >
              <Text style={styles.mentorButtonText}>Erfahre mehr!</Text>
            </Pressable>
          </View>
        </ImageBackground>

        {/* Tracker */}
        <View style={styles.trackerSection}>
          <Text style={styles.trackerTitle}>ACTIVE TRACKER</Text>

          <Text style={styles.trackerSubtitle}>
            Deine heutigen Fortschritte auf einen Blick.
          </Text>

          <View style={styles.trackerRow}>
            {trackerItems.map((item, index) => (
              <TrackerBox
                key={`tracker-${index}`}
                value={item.value}
                label={item.label}
              />
            ))}
          </View>
        </View>
      </View>
    </Pressable>
  );
}