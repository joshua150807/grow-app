import { useState } from 'react';
import {
  View,
  Text,
  Image,
  ImageBackground,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

// constants
import { COLORS } from '../../../../constants/colors';
import { s, sv, SCREEN } from '../../../../constants/layout';

// services / hooks aus anderen tools
import { useProfile } from '../.././../profile/hooks/useProfile';
import { supabase } from '../../../../services/supabaseClient';

// eigene components
import ToolCard from '../components/ToolCard';
import TrackerBox from '../components/Trackerbox';
import DraggableSixToolGrid from '../components/DraggableSixToolGrid';
import AnimatedToolsGridSwitcher from '../components/AnimatedToolsGridSwitcher';
import { useToolsTrackerData } from '../hooks/useToolsTrackerData';
import { useToolsOverviewPreferences } from '../hooks/useToolsOverviewPreferences';

// styles
import { styles } from '../styles/toolsOverviewStyles';

import { MENTOR_BG } from '../../../../constants/toolAssets';

const GROW_AVATAR = require('../../../../assets/images/grow_avatar.png');

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
  const { trackerItems } = useToolsTrackerData();

  const [menuOpen, setMenuOpen] = useState(false);

  const {
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
  } = useToolsOverviewPreferences();

  return (
    <Pressable 
      onPress={() => handleScreenPress(() => setMenuOpen(false))}
      style={styles.screen}
    >
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