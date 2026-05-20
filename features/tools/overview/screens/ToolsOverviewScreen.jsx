import { useEffect, useState } from 'react';
import { View, Text, Image, ImageBackground, Pressable, useWindowDimensions } from 'react-native';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Asset } from 'expo-asset';

// data
import { tools } from '../../../../data/tools'

// constants
import { COLORS } from '../../../../constants/colors';
import { s, sv, sf, SCREEN } from '../../../../constants/layout';

// services / hooks aus anderen tools
import { getHabitStreak, getTodayHabitProgress } from '../../habits/services/habits'
import { getTodayDeepWorkSeconds } from '../../deep-work/services/deepWorkStore'
import { useSteps } from '../../../steps/hooks/useSteps'
import { useProfile } from '../.././../profile/hooks/useProfile'
import { supabase } from '../../../../services/supabaseClient';

// eigene components
import ToolCard from '../components/ToolCard';
import TrackerBox from '../components/Trackerbox';

// styles
import { styles } from '../styles/toolsOverviewStyles';

// < 900pt (iPhone 15 Pro 852pt, iPhone 16 Pro 874pt): kompakte Abstände
// < 700pt (iPhone SE 667pt): sehr kompakte Abstände
const compact = SCREEN.height < 900;
const veryCompact = SCREEN.height < 700;

import { MENTOR_BG } from '../../../../constants/toolAssets';
const GROW_AVATAR = require('../../../../assets/images/grow_avatar.png');
 
function formatDeepWork(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function formatSteps(count) {
  if (count >= 1000) {
    return `${Math.floor(count / 1000)}.${String(count % 1000).padStart(3, '0')}`;
  }
  return String(count);
}
 
function renderToolIcon(tool) {
  const iconColor = tool.disabled ? COLORS.toolsTextDim : COLORS.toolsGold;

  if (tool.type === 'Ionicons')
    return <Ionicons name={tool.name} size={s(20)} color={iconColor} />;

  if (tool.type === 'MaterialCommunityIcons')
    return <MaterialCommunityIcons name={tool.name} size={s(20)} color={iconColor} />;

  if (tool.type === 'Feather')
    return <Feather name={tool.name} size={s(20)} color={iconColor} />;

  return null;
}
 
export default function ToolsScreen() {

  const { height, width } = useWindowDimensions();

  const runtimeVeryCompact = height < 760;
  const runtimeCompact = height < 900;

  const horizontalPadding = s(14) * 2;
  const gridWidth = width - horizontalPadding;
  const cardWidth = gridWidth * 0.315;

  // Muss grob mit styles.content zusammenpassen
  const topPaddingReserve = runtimeVeryCompact ? sv(44) : runtimeCompact ? sv(50) : sv(62);
  const bottomPaddingReserve = runtimeVeryCompact ? sv(48) : runtimeCompact ? sv(56) : sv(68);

  // Header + TOOLS Titel, ohne Subtitle
  const headerReserve = runtimeVeryCompact ? sv(54) : runtimeCompact ? sv(60) : sv(70);
  const titleReserve = runtimeVeryCompact ? sv(38) : runtimeCompact ? sv(42) : sv(48);

  // Zwei feste obere Tool-Reihen + deren vertikale Abstände
  const activeToolsReserve =
    cardWidth * 2 +
    (runtimeVeryCompact ? sv(10) : runtimeCompact ? sv(12) : sv(16));

  // Mentor und Tracker bleiben sichtbar, dürfen aber etwas kleiner werden
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

  // Flexible Puffer-Reihe: darf kleiner werden, aber nie größer als obere Cards
  const comingSoonCardHeight = Math.max(
    runtimeVeryCompact ? sv(54) : runtimeCompact ? sv(66) : sv(78),
    Math.min(availableComingSoonHeight, cardWidth)
  );;

  const { username, growPoints, isCeo } = useProfile();
  const [menuOpen, setMenuOpen] = useState(false);

  const [streak, setStreak] = useState(0);
  const [habitProgress, setHabitProgress] = useState({ completed: 0, total: 0 });
  const [deepWorkTime, setDeepWorkTime] = useState(0);
  const steps = useSteps();

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
 
  return (
    <Pressable onPress={() => setMenuOpen(false)} style={styles.screen}>
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
              onPress={(e) => { e.stopPropagation(); setMenuOpen((p) => !p); }}
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
 
        {/* Tools Grid */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>TOOLS</Text>
        </View>
 
        <View style={styles.grid}>
          {tools.map((tool) => (
            <ToolCard
              key={tool.id}
              icon={tool.image ? undefined : renderToolIcon(tool)}
              image={tool.image}
              onPress={tool.disabled ? undefined : () => router.push(tool.route)}
              title={tool.title}
              description={tool.description}
              disabled={tool.disabled}
              cardStyle={tool.disabled ? { height: comingSoonCardHeight } : undefined}
            />
          ))}
        </View>

        <Pressable
          onPress={() => router.push('/tools/journal')}
          style={{
            marginTop: sv(8),
            marginBottom: sv(4),
            borderRadius: s(12),
            borderWidth: 1,
            borderColor: 'rgba(231,201,138,0.45)',
            backgroundColor: 'rgba(231,201,138,0.08)',
            paddingVertical: sv(9),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              color: COLORS.toolsGold,
              fontSize: sf(12),
              fontWeight: '600',
              letterSpacing: 0.4,
            }}
          >
            Journal testen
          </Text>
        </Pressable>
 
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
              <TrackerBox key={`tracker-${index}`} value={item.value} label={item.label} />
            ))}
          </View>
        </View>
 
      </View>
    </Pressable>
  );
}