import { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  useWindowDimensions,
  LayoutAnimation,
  Platform,
} from 'react-native';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { COLORS } from '../../../../constants/colors';
import { s, sv } from '../../../../constants/layout';
import { MENTOR_BG } from '../../../../constants/toolAssets';

import { useProfile } from '../../../profile/hooks/useProfile';
import { supabase } from '../../../../services/supabaseClient';

import TrackerBox from '../components/Trackerbox';
import AnimatedToolsGridSwitcher from '../components/AnimatedToolsGridSwitcher';

import { useToolsTrackerData } from '../hooks/useToolsTrackerData';
import { useToolsOverviewPreferences } from '../hooks/useToolsOverviewPreferences';
import { getToolsOverviewLayout } from '../utils/getToolsOverviewLayout';

import { styles } from '../styles/toolsOverviewStyles';

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
  const layout = getToolsOverviewLayout({ width, height });

  const [viewportHeight, setViewportHeight] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  const { username, growPoints, isCeo } = useProfile();
  const { trackerItems } = useToolsTrackerData();

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

  const shouldUseFlexibleSpacer = !isExpandedTools && !replacementToolId;


  const handleLogout = async () => {
    setMenuOpen(false);

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.log('[ToolsOverview] Logout failed:', error);
      return;
    }

    router.replace('/login');
  };

  return (
    <Pressable
      onPress={() => handleScreenPress(() => setMenuOpen(false))}
      style={styles.screen}
    >
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{
          paddingTop: layout.contentPaddingTop,
          paddingHorizontal: layout.horizontalPadding,
          paddingBottom: layout.contentPaddingBottom,
        }}
        scrollEnabled={layout.needsScroll}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Header */}
        <View
          style={[
            styles.header,
            {
              marginBottom: layout.headerMarginBottom,
              paddingHorizontal: s(2),
            },
          ]}
        >
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
              <Text style={styles.accountName} numberOfLines={1}>
                {username}
              </Text>
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
              onPress={(event) => {
                event.stopPropagation();
                setMenuOpen((previous) => !previous);
              }}
              style={styles.menuButton}
              hitSlop={8}
            >
              <Feather name="more-vertical" size={s(20)} color={COLORS.softGold} />
            </Pressable>

            {menuOpen && (
              <Pressable
                style={styles.dropdown}
                onPress={(event) => event.stopPropagation()}
              >
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
        <View
          style={[
            styles.sectionHeaderRow,
            {
              marginBottom: layout.toolsHeaderMarginBottom,
            },
          ]}
        >
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
          overviewLayout={layout}
          renderToolIcon={renderToolIcon}
          onToolPress={handleToolPress}
          onReorder={handleReorderOverviewTools}
          onReorderModeChange={setReorderMode}
          onExitReorderMode={() => setReorderMode(false)}
          onModeChange={handleSetToolsViewMode}
          onOpenAllTools={() => router.push('/tools/all-tools')}
        />

        {/* Abstand nach Grid */}
        <View
          pointerEvents="none"
          style={{
            height: layout.gridMarginBottom,
            flexShrink: 0,
          }}
        />

        {/* KI Mentor Card */}
        <ImageBackground
          source={MENTOR_BG}
          style={[
            styles.mentorCard,
            {
              marginTop: layout.mentorMarginTop,
              marginBottom: layout.mentorMarginBottom,
              height: layout.mentorCardHeight,
            },
          ]}
          imageStyle={styles.mentorCardImage}
          resizeMode="stretch"
        >
          <View style={styles.mentorOverlay}>
            <View style={styles.mentorLeft}>
              <View style={styles.mentorTextBox}>
                <Text style={styles.mentorTitle}>KI Mentor</Text>
                <Text style={styles.mentorDescription} numberOfLines={2}>
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
        <View
          style={[
            styles.trackerSection,
            {
              marginTop: layout.trackerMarginTop,
            },
          ]}
        >
          <Text style={styles.trackerTitle}>ACTIVE TRACKER</Text>

          <Text style={styles.trackerSubtitle}>
            Deine heutigen Fortschritte auf einen Blick.
          </Text>

          <View
            style={[
              styles.trackerRow,
              {
                height: layout.trackerRowHeight,
                gap: layout.trackerGap,
              },
            ]}
          >
            {trackerItems.map((item, index) => (
              <TrackerBox
                key={`tracker-${index}`}
                value={item.value}
                label={item.label}
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </Pressable>
  );
}