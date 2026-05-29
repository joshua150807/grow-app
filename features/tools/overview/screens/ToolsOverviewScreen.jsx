import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  ImageBackground,
  Pressable,
  Animated,
  Easing,
  ScrollView,
  useWindowDimensions,
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
import PressableScale from '../../../../components/ui/PressableScale';
import { useOnboarding } from '../../../onboarding/context/OnboardingContext';
import TourTarget from '../../../onboarding/components/TourTarget';

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

  const [menuOpen, setMenuOpen] = useState(false);
  const menuAnimation = useRef(new Animated.Value(0)).current;

  const { username, growPoints, isCeo } = useProfile();
  const { startTutorial } = useOnboarding();
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


  useEffect(() => {
    if (!menuOpen) return;

    menuAnimation.setValue(0);

    Animated.timing(menuAnimation, {
      toValue: 1,
      duration: 145,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [menuOpen, menuAnimation]);

  const dropdownAnimatedStyle = {
    opacity: menuAnimation,
    transform: [
      {
        translateY: menuAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: [-6, 0],
        }),
      },
      {
        scale: menuAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: [0.97, 1],
        }),
      },
    ],
  };

  const handleLogout = async () => {
    setMenuOpen(false);

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.log('[ToolsOverview] Logout failed:', error);
      return;
    }

    router.replace('/login');
  };

  const handleOutsideMenuPress = () => {
    handleScreenPress(() => setMenuOpen(false));
  };

  const navigateFromMenu = (route) => {
    setMenuOpen(false);
    router.push(route);
  };

  const handleStartTutorialFromMenu = () => {
    setMenuOpen(false);
    startTutorial();
  };

  return (
    <View style={styles.screen}>
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
            <TourTarget id="grow-points-box" style={styles.pointsBox}>
              <View style={styles.pointsRow}>
                <View style={styles.coinPlaceholder}>
                  <Text style={styles.coinStar}>★</Text>
                </View>

                <Text style={styles.pointsValue}>
                  {growPoints.toLocaleString('de-DE')}
                </Text>
              </View>

              <Text style={styles.pointsLabel}>GROW Points</Text>
            </TourTarget>

            <PressableScale
              onPress={(event) => {
                event.stopPropagation();
                setMenuOpen((previous) => !previous);
              }}
              activeScale={0.92}
              activeOpacity={0.78}
              style={styles.menuButton}
              hitSlop={10}
            >
              <Feather name="more-vertical" size={s(20)} color={COLORS.softGold} />
            </PressableScale>
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
            <PressableScale
              style={styles.sectionSmallButton}
              onPress={handleToggleToolsViewMode}
              activeScale={0.96}
              activeOpacity={0.84}
              hitSlop={8}
            >
              <Text style={styles.sectionSmallButtonText}>
                {isExpandedTools ? '2x3' : '4x4'}
              </Text>
            </PressableScale>
          </View>
        </View>

        {/* Ersetzen-Modus */}
        {replacementToolId && (
          <View style={styles.replacePanel}>
            <Text style={styles.replacePanelTitle}>Tool ersetzen</Text>

            <Text style={styles.replacePanelText}>
              {replacementTool
                ? `Ziehe „${replacementTool.title}“ auf den Slot, den du auf deiner 2x3-Tools-Seite ersetzen möchtest.`
                : 'Ziehe das ausgewählte Tool auf den Slot, den du ersetzen möchtest.'}
            </Text>

            <PressableScale
              style={styles.replaceCancelButton}
              onPress={handleCancelReplacement}
              activeScale={0.97}
              activeOpacity={0.84}
            >
              <Text style={styles.replaceCancelText}>Abbrechen</Text>
            </PressableScale>
          </View>
        )}

        {/* Tools Grid */}
        <TourTarget id="tools-grid">
          <AnimatedToolsGridSwitcher
            mode={toolsViewMode}
            overviewTools={overviewTools}
            visibleToolSlots={visibleToolSlots}
            replacementToolId={replacementToolId}
            replacementTool={replacementTool}
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
        </TourTarget>

        {/* Abstand nach Grid */}
        <View
          pointerEvents="none"
          style={{
            height: layout.gridMarginBottom,
            flexShrink: 0,
          }}
        />

        {/* KI Mentor Card */}
        <TourTarget id="mentor-card">
          <PressableScale
          onPress={() => router.push('/tools/mentor')}
          activeScale={0.985}
          activeOpacity={0.9}
          style={[
            styles.mentorCard,
            {
              marginTop: layout.mentorMarginTop,
              marginBottom: layout.mentorMarginBottom,
              height: layout.mentorCardHeight,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="KI Mentor öffnen"
        >
          <ImageBackground
            source={MENTOR_BG}
            style={{ flex: 1 }}
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

              <View style={styles.mentorButton} pointerEvents="none">
                <Text style={styles.mentorButtonText}>Erfahre mehr!</Text>
              </View>
            </View>
          </ImageBackground>
          </PressableScale>
        </TourTarget>

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

      {menuOpen && (
        <>
          <Pressable
            style={styles.menuBackdrop}
            onPress={handleOutsideMenuPress}
          />

          <Animated.View
            style={[
              styles.dropdown,
              {
                top: layout.contentPaddingTop + sv(46),
                right: layout.horizontalPadding,
              },
              dropdownAnimatedStyle,
            ]}
          >
            <PressableScale
              style={styles.menuAction}
              activeScale={0.985}
              activeOpacity={0.72}
              onPress={() => navigateFromMenu('/tools/saved-videos')}
            >
              <Text style={styles.menuItem}>Gespeicherte Videos</Text>
            </PressableScale>

            <PressableScale
              style={styles.menuAction}
              activeScale={0.985}
              activeOpacity={0.72}
              onPress={handleStartTutorialFromMenu}
            >
              <Text style={styles.menuItem}>Tutorial starten</Text>
            </PressableScale>

            <PressableScale
              style={styles.menuAction}
              activeScale={0.985}
              activeOpacity={0.72}
              onPress={() => navigateFromMenu('/tools/privacy')}
            >
              <Text style={styles.menuItem}>Datenschutz</Text>
            </PressableScale>

            <PressableScale
              style={styles.menuAction}
              activeScale={0.985}
              activeOpacity={0.72}
              onPress={() => navigateFromMenu('/tools/imprint')}
            >
              <Text style={styles.menuItem}>Impressum</Text>
            </PressableScale>

            {isCeo && (
              <PressableScale
                style={styles.menuAction}
                activeScale={0.985}
                activeOpacity={0.72}
                onPress={() => navigateFromMenu('/admin-dashboard')}
              >
                <Text style={styles.menuItem}>CEO Dashboard</Text>
              </PressableScale>
            )}

            <View style={styles.line} />

            <PressableScale
              style={styles.menuAction}
              activeScale={0.985}
              activeOpacity={0.72}
              onPress={handleLogout}
            >
              <Text style={styles.logoutItem}>Logout</Text>
            </PressableScale>
          </Animated.View>
        </>
      )}
    </View>
  );
}