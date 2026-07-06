import { useEffect, useMemo, useState } from 'react';
import {
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS } from '../../../constants/colors';
import { s, sv, sf } from '../../../constants/layout';
import {
  GROW_AVATAR,
  GROW_COIN,
  GROW_POINTS_ICON,
} from '../../../constants/toolAssets';
import { useProfile } from '../hooks/useProfile';
import { useToolsTrackerData } from '../../tools/overview/hooks/useToolsTrackerData';

const PROFILE_MOTTO = 'Bereit für den nächsten klaren Schritt.';
const MOCK_GROW_COINS = 0;

// Temporary UI-only values until these tools expose lightweight profile summary data.
const PROFILE_STATS_MOCKS = {
  trainings: '0',
  goals: '0',
  plannedDays: '0',
};

const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;
const TAB_BAR_HEIGHT = sv(68);
const TAB_BAR_DEFAULT_BOTTOM = 1;
const SAMSUNG_LARGE_NAV_INSET_THRESHOLD = 32;
const IS_SAMSUNG_ANDROID =
  Platform.OS === 'android' &&
  String(Platform.constants?.Manufacturer ?? '').toLowerCase() === 'samsung';

function formatNumber(value) {
  const safeNumber = Math.max(0, Number(value ?? 0) || 0);
  return safeNumber.toLocaleString('de-DE');
}

function formatDeepWork(seconds) {
  const safeSeconds = Math.max(0, Number(seconds ?? 0) || 0);
  const minutes = Math.floor(safeSeconds / 60);

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function validateUsername(value) {
  const normalized = value.trim().toLowerCase();

  if (normalized.length < 3) {
    return 'Mindestens 3 Zeichen.';
  }

  if (normalized.length > 30) {
    return 'Maximal 30 Zeichen.';
  }

  if (!USERNAME_REGEX.test(normalized)) {
    return 'Nur Buchstaben, Zahlen und Unterstrich.';
  }

  return '';
}

function StatTile({
  icon,
  value,
  label,
  isRight,
  isBottom,
  iconSize,
  tileHeight,
  valueStyle,
  labelStyle,
}) {
  return (
    <View
      style={[
        styles.statTile,
        { minHeight: tileHeight },
        !isRight && styles.statTileBorderRight,
        !isBottom && styles.statTileBorderBottom,
      ]}
    >
      <MaterialCommunityIcons name={icon} size={iconSize} color={COLORS.gold} />
      <Text style={[styles.statValue, valueStyle]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={[styles.statLabel, labelStyle]} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

function ProfileEditModal({ visible, username, onClose }) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState(username);
  const normalized = draft.trim().toLowerCase();
  const error = validateUsername(draft);
  const isUnchanged = normalized === username.trim().toLowerCase();

  useEffect(() => {
    if (visible) {
      setDraft(username);
    }
  }, [username, visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : sv(18)}
        style={styles.modalRoot}
      >
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View
          style={[
            styles.editSheet,
            {
              paddingBottom: Math.max(insets.bottom + sv(16), sv(28)),
            },
          ]}
        >
          <ScrollView
            bounces={false}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.editSheetContent}
          >
            <View style={styles.editHandle} />
            <Text style={styles.editTitle}>Profil bearbeiten</Text>
            <Text style={styles.editSubtitle}>
              Passe deinen Benutzernamen an.
            </Text>

            <Text style={styles.inputLabel}>Username</Text>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={30}
              returnKeyType="done"
              placeholder="username"
              placeholderTextColor={COLORS.textFaint}
              style={[
                styles.usernameInput,
                Boolean(error) && styles.usernameInputError,
              ]}
            />

            <View style={styles.editMetaRow}>
              <Text style={[styles.editHint, Boolean(error) && styles.editError]}>
                {error || `Zielwert: ${normalized}`}
              </Text>
              <Text style={styles.charCount}>{normalized.length}/30</Text>
            </View>

            <View style={styles.editActions}>
              <Pressable
                onPress={onClose}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.secondaryButtonText}>Schließen</Text>
              </Pressable>

              <Pressable
                disabled
                accessibilityState={{ disabled: true }}
                style={[
                  styles.saveButton,
                  styles.saveButtonDisabled,
                  (!error && !isUnchanged) && styles.saveButtonPrepared,
                ]}
              >
                <Text style={styles.saveButtonText}>Speichern</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { username, growPoints } = useProfile();
  const { streak, todoProgress, deepWorkTime } = useToolsTrackerData();
  const [editVisible, setEditVisible] = useState(false);

  const tabBarBottom =
    IS_SAMSUNG_ANDROID && insets.bottom > SAMSUNG_LARGE_NAV_INSET_THRESHOLD
      ? insets.bottom
      : TAB_BAR_DEFAULT_BOTTOM;
  const bottomNavReserve = TAB_BAR_HEIGHT + tabBarBottom;
  const baseAvailableHeight = height - insets.top - bottomNavReserve;
  const veryCompact = baseAvailableHeight < 650;
  const compact = baseAvailableHeight < 735;
  const topPadding = Math.max(
    insets.top + (veryCompact ? sv(6) : compact ? sv(8) : sv(12)),
    veryCompact ? sv(24) : compact ? sv(30) : sv(36),
  );
  const fallbackBottomPadding = bottomNavReserve + (veryCompact ? sv(6) : sv(10));
  const avatarSize = veryCompact
    ? Math.min(Math.max(width * 0.28, s(94)), s(112))
    : compact
      ? Math.min(Math.max(width * 0.32, s(112)), s(136))
      : Math.min(Math.max(width * 0.36, s(132)), s(166));
  const avatarGlowPadding = veryCompact ? s(12) : compact ? s(16) : s(22);
  const cameraSize = veryCompact ? s(34) : compact ? s(38) : s(44);
  const statTileHeight = veryCompact ? sv(76) : compact ? sv(86) : sv(104);
  const statIconSize = veryCompact ? s(17) : compact ? s(19) : s(21);
  const settingsIconSize = veryCompact ? s(32) : compact ? s(35) : s(40);

  const statItems = useMemo(() => [
    {
      icon: 'fire',
      value: String(streak),
      label: 'Streak',
    },
    {
      icon: 'check-circle-outline',
      value: `${todoProgress.completed}/${todoProgress.total}`,
      label: 'To-dos abgeschlossen',
    },
    {
      icon: 'brain',
      value: formatDeepWork(deepWorkTime),
      label: 'Deep Work',
    },
    {
      icon: 'dumbbell',
      value: PROFILE_STATS_MOCKS.trainings,
      label: 'Trainings',
    },
    {
      icon: 'flag-outline',
      value: PROFILE_STATS_MOCKS.goals,
      label: 'Ziele definiert',
    },
    {
      icon: 'calendar-month-outline',
      value: PROFILE_STATS_MOCKS.plannedDays,
      label: 'Tage geplant',
    },
  ], [deepWorkTime, streak, todoProgress.completed, todoProgress.total]);

  return (
    <View style={styles.screen}>
      <ImageBackground
        source={require('../../../assets/images/grow_banner_lossless.webp')}
        style={styles.backgroundImage}
        imageStyle={styles.backgroundImageAsset}
        resizeMode="cover"
      >
        <View style={styles.backgroundOverlay} />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: topPadding,
              paddingBottom: fallbackBottomPadding,
            },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={[
              styles.hero,
              {
                paddingTop: veryCompact ? 0 : compact ? sv(2) : sv(6),
                marginBottom: veryCompact ? sv(8) : compact ? sv(10) : sv(16),
              },
            ]}
          >
            <View
              style={[
                styles.avatarGlow,
                {
                  width: avatarSize + avatarGlowPadding,
                  height: avatarSize + avatarGlowPadding,
                  borderRadius: (avatarSize + avatarGlowPadding) / 2,
                },
              ]}
            >
              <View
                style={[
                  styles.avatarRing,
                  {
                    width: avatarSize,
                    height: avatarSize,
                    borderRadius: avatarSize / 2,
                  },
                ]}
              >
                <Image
                  source={GROW_AVATAR}
                  style={styles.avatarImage}
                  resizeMode="contain"
                />
              </View>

              <Pressable
                disabled
                style={({ pressed }) => [
                  styles.cameraButton,
                  {
                    bottom: veryCompact ? s(2) : s(4),
                    width: cameraSize,
                    height: cameraSize,
                    borderRadius: cameraSize / 2,
                  },
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Avatar ändern"
                accessibilityState={{ disabled: true }}
              >
                <Ionicons
                  name="camera-outline"
                  size={veryCompact ? s(17) : compact ? s(19) : s(21)}
                  color={COLORS.softGold}
                />
              </Pressable>
            </View>

            <Text
              style={[
                styles.username,
                {
                  marginTop: veryCompact ? sv(7) : compact ? sv(9) : sv(12),
                  fontSize: veryCompact ? sf(22) : compact ? sf(24) : sf(28),
                },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {username}
            </Text>
            <Text
              style={[
                styles.motto,
                {
                  marginTop: veryCompact ? sv(3) : sv(4),
                  fontSize: veryCompact ? sf(11) : sf(12),
                  lineHeight: veryCompact ? sf(15) : sf(17),
                },
              ]}
              numberOfLines={2}
            >
              {PROFILE_MOTTO}
            </Text>
          </View>

          <View
            style={[
              styles.currencyRow,
              { marginBottom: veryCompact ? sv(7) : compact ? sv(9) : sv(13) },
            ]}
          >
            <View
              style={[
                styles.currencyCard,
                {
                  minHeight: veryCompact ? sv(68) : compact ? sv(76) : sv(94),
                  paddingVertical: veryCompact ? sv(7) : compact ? sv(9) : sv(12),
                  borderRadius: veryCompact ? s(17) : s(20),
                },
              ]}
            >
              <Image
                source={GROW_POINTS_ICON}
                style={[
                  styles.currencyIcon,
                  {
                    width: veryCompact ? s(26) : compact ? s(30) : s(36),
                    height: veryCompact ? s(26) : compact ? s(30) : s(36),
                  },
                ]}
                resizeMode="contain"
              />
              <View style={styles.currencyTextStack}>
                <Text
                  style={[
                    styles.currencyValue,
                    { fontSize: veryCompact ? sf(18) : compact ? sf(20) : sf(24) },
                  ]}
                >
                  {formatNumber(growPoints)}
                </Text>
                <Text
                  style={[
                    styles.currencyLabel,
                    { fontSize: veryCompact ? sf(9.5) : sf(10.5) },
                  ]}
                >
                  GROW Points
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.currencyCard,
                {
                  minHeight: veryCompact ? sv(68) : compact ? sv(76) : sv(94),
                  paddingVertical: veryCompact ? sv(7) : compact ? sv(9) : sv(12),
                  borderRadius: veryCompact ? s(17) : s(20),
                },
              ]}
            >
              <Image
                source={GROW_COIN}
                style={[
                  styles.currencyIcon,
                  {
                    width: veryCompact ? s(26) : compact ? s(30) : s(36),
                    height: veryCompact ? s(26) : compact ? s(30) : s(36),
                  },
                ]}
                resizeMode="contain"
              />
              <View style={styles.currencyTextStack}>
                <Text
                  style={[
                    styles.currencyValue,
                    { fontSize: veryCompact ? sf(18) : compact ? sf(20) : sf(24) },
                  ]}
                >
                  {formatNumber(MOCK_GROW_COINS)}
                </Text>
                <Text
                  style={[
                    styles.currencyLabel,
                    { fontSize: veryCompact ? sf(9.5) : sf(10.5) },
                  ]}
                >
                  GROW Coins
                </Text>
              </View>
            </View>
          </View>

          <View
            style={[
              styles.statsCard,
              {
                paddingHorizontal: veryCompact ? s(10) : s(12),
                paddingTop: veryCompact ? sv(9) : compact ? sv(11) : sv(15),
                paddingBottom: veryCompact ? sv(5) : compact ? sv(7) : sv(10),
                marginBottom: veryCompact ? sv(7) : compact ? sv(9) : sv(13),
                borderRadius: veryCompact ? s(18) : s(22),
              },
            ]}
          >
            <View
              style={[
                styles.cardHeader,
                { marginBottom: veryCompact ? sv(5) : compact ? sv(7) : sv(11) },
              ]}
            >
              <Text
                style={[
                  styles.cardTitle,
                  { fontSize: veryCompact ? sf(10) : sf(11.5) },
                ]}
              >
                INDIVIDUELLE STATISTIKEN
              </Text>
              <Ionicons
                name="information-circle-outline"
                size={veryCompact ? s(16) : s(18)}
                color={COLORS.dimGold}
              />
            </View>

            <View style={styles.statsGrid}>
              {statItems.map((item, index) => (
                <StatTile
                  key={item.label}
                  icon={item.icon}
                  value={item.value}
                  label={item.label}
                  isRight={(index + 1) % 3 === 0}
                  isBottom={index >= 3}
                  iconSize={statIconSize}
                  tileHeight={statTileHeight}
                  valueStyle={{
                    marginTop: veryCompact ? sv(4) : compact ? sv(5) : sv(7),
                    fontSize: veryCompact ? sf(15) : compact ? sf(17) : sf(20),
                  }}
                  labelStyle={{
                    marginTop: veryCompact ? sv(2) : sv(3),
                    fontSize: veryCompact ? sf(8.5) : compact ? sf(9.5) : sf(10.5),
                    lineHeight: veryCompact ? sf(11) : compact ? sf(12.5) : sf(14),
                  }}
                />
              ))}
            </View>
          </View>

          <View
            style={[
              styles.settingsCard,
              { borderRadius: veryCompact ? s(18) : s(22) },
            ]}
          >
            <Pressable
              onPress={() => setEditVisible(true)}
              style={({ pressed }) => [
                styles.settingsRow,
                {
                  minHeight: veryCompact ? sv(54) : compact ? sv(60) : sv(70),
                  paddingHorizontal: veryCompact ? s(11) : s(14),
                  paddingVertical: veryCompact ? sv(7) : compact ? sv(9) : sv(11),
                },
                pressed && styles.settingsRowPressed,
              ]}
              accessibilityRole="button"
            >
              <View
                style={[
                  styles.settingsIconWrap,
                  {
                    width: settingsIconSize,
                    height: settingsIconSize,
                    borderRadius: settingsIconSize / 2,
                    marginRight: veryCompact ? s(9) : s(11),
                  },
                ]}
              >
                <Ionicons
                  name="person-outline"
                  size={veryCompact ? s(17) : s(20)}
                  color={COLORS.gold}
                />
              </View>
              <View style={styles.settingsTextWrap}>
                <Text
                  style={[
                    styles.settingsTitle,
                    { fontSize: veryCompact ? sf(13.5) : sf(15) },
                  ]}
                >
                  Profil bearbeiten
                </Text>
                <Text
                  style={[
                    styles.settingsSubtitle,
                    { fontSize: veryCompact ? sf(10) : sf(11) },
                  ]}
                >
                  Anzeigename, Avatar, Bio
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={veryCompact ? s(18) : s(20)}
                color={COLORS.dimGold}
              />
            </Pressable>

            <View
              style={[
                styles.settingsDivider,
                { marginLeft: veryCompact ? s(52) : s(64) },
              ]}
            />

            <Pressable
              disabled
              style={({ pressed }) => [
                styles.settingsRow,
                {
                  minHeight: veryCompact ? sv(54) : compact ? sv(60) : sv(70),
                  paddingHorizontal: veryCompact ? s(11) : s(14),
                  paddingVertical: veryCompact ? sv(7) : compact ? sv(9) : sv(11),
                },
                pressed && styles.settingsRowPressed,
              ]}
              accessibilityRole="button"
              accessibilityState={{ disabled: true }}
            >
              <View
                style={[
                  styles.settingsIconWrap,
                  {
                    width: settingsIconSize,
                    height: settingsIconSize,
                    borderRadius: settingsIconSize / 2,
                    marginRight: veryCompact ? s(9) : s(11),
                  },
                ]}
              >
                <Ionicons
                  name="settings-outline"
                  size={veryCompact ? s(17) : s(20)}
                  color={COLORS.gold}
                />
              </View>
              <View style={styles.settingsTextWrap}>
                <Text
                  style={[
                    styles.settingsTitle,
                    { fontSize: veryCompact ? sf(13.5) : sf(15) },
                  ]}
                >
                  Einstellungen
                </Text>
                <Text
                  style={[
                    styles.settingsSubtitle,
                    { fontSize: veryCompact ? sf(10) : sf(11) },
                  ]}
                >
                  App Einstellungen & Präferenzen
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={veryCompact ? s(18) : s(20)}
                color={COLORS.dimGold}
              />
            </Pressable>
          </View>
        </ScrollView>
      </ImageBackground>

      <ProfileEditModal
        visible={editVisible}
        username={username}
        onClose={() => setEditVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  backgroundImage: {
    flex: 1,
  },
  backgroundImageAsset: {
    opacity: 0.14,
  },
  backgroundOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(3, 3, 5, 0.88)',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: s(18),
  },
  hero: {
    alignItems: 'center',
  },
  avatarGlow: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 14,
  },
  avatarRing: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: COLORS.goldBorderLight,
    backgroundColor: 'rgba(13, 9, 19, 0.96)',
  },
  avatarImage: {
    width: '92%',
    height: '92%',
  },
  cameraButton: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(5, 5, 8, 0.96)',
    borderWidth: 1,
    borderColor: COLORS.goldBorderLight,
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.32,
    shadowRadius: 10,
    elevation: 10,
  },
  username: {
    maxWidth: '92%',
    color: COLORS.paleGold,
    fontWeight: '800',
    textAlign: 'center',
  },
  motto: {
    maxWidth: s(280),
    color: 'rgba(214,208,219,0.72)',
    textAlign: 'center',
  },
  currencyRow: {
    flexDirection: 'row',
    gap: s(12),
  },
  currencyCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    backgroundColor: 'rgba(13, 9, 19, 0.84)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: s(12),
  },
  currencyIcon: {
    marginRight: s(9),
  },
  currencyTextStack: {
    flexShrink: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  currencyValue: {
    color: COLORS.paleGold,
    fontWeight: '800',
    textAlign: 'left',
  },
  currencyLabel: {
    marginTop: sv(3),
    color: COLORS.textMuted,
    fontWeight: '700',
    textAlign: 'left',
  },
  statsCard: {
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    backgroundColor: 'rgba(10, 8, 15, 0.92)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    color: COLORS.paleGold,
    fontWeight: '900',
    letterSpacing: 1.3,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statTile: {
    width: '33.333%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: s(6),
    paddingVertical: sv(6),
  },
  statTileBorderRight: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: 'rgba(231,201,138,0.18)',
  },
  statTileBorderBottom: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(231,201,138,0.18)',
  },
  statValue: {
    color: COLORS.paleGold,
    fontWeight: '900',
    textAlign: 'center',
  },
  statLabel: {
    color: 'rgba(214,208,219,0.72)',
    fontWeight: '600',
    textAlign: 'center',
  },
  settingsCard: {
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    backgroundColor: 'rgba(13, 9, 19, 0.90)',
    overflow: 'hidden',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsRowPressed: {
    backgroundColor: 'rgba(231,201,138,0.06)',
  },
  settingsIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(231,201,138,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.goldBorder,
  },
  settingsTextWrap: {
    flex: 1,
  },
  settingsTitle: {
    color: COLORS.paleGold,
    fontWeight: '800',
  },
  settingsSubtitle: {
    marginTop: sv(3),
    color: COLORS.textDim,
    fontWeight: '600',
  },
  settingsDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(231,201,138,0.14)',
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.98 }],
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  editSheet: {
    maxHeight: '76%',
    borderTopLeftRadius: s(28),
    borderTopRightRadius: s(28),
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: COLORS.goldBorder,
    backgroundColor: COLORS.darkCard,
    paddingHorizontal: s(20),
    paddingTop: sv(10),
  },
  editSheetContent: {
    paddingBottom: sv(2),
  },
  editHandle: {
    alignSelf: 'center',
    width: s(42),
    height: sv(4),
    borderRadius: s(99),
    backgroundColor: 'rgba(231,201,138,0.38)',
    marginBottom: sv(14),
  },
  editTitle: {
    color: COLORS.paleGold,
    fontSize: sf(20),
    fontWeight: '900',
  },
  editSubtitle: {
    marginTop: sv(6),
    color: COLORS.textDim,
    fontSize: sf(12),
    lineHeight: sf(17),
  },
  inputLabel: {
    marginTop: sv(18),
    marginBottom: sv(7),
    color: COLORS.textMuted,
    fontSize: sf(11),
    fontWeight: '900',
    letterSpacing: 1,
  },
  usernameInput: {
    minHeight: sv(52),
    borderRadius: s(16),
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    backgroundColor: COLORS.black,
    color: COLORS.paleGold,
    fontSize: sf(16),
    fontWeight: '700',
    paddingHorizontal: s(14),
  },
  usernameInputError: {
    borderColor: 'rgba(255,122,122,0.60)',
  },
  editMetaRow: {
    marginTop: sv(7),
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: s(12),
  },
  editHint: {
    flex: 1,
    color: COLORS.textDim,
    fontSize: sf(11),
    lineHeight: sf(15),
  },
  editError: {
    color: COLORS.errorLight,
  },
  charCount: {
    color: COLORS.textFaint,
    fontSize: sf(11),
    fontWeight: '700',
  },
  editActions: {
    flexDirection: 'row',
    gap: s(10),
    marginTop: sv(18),
  },
  secondaryButton: {
    flex: 1,
    minHeight: sv(46),
    borderRadius: s(15),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  secondaryButtonText: {
    color: COLORS.paleGold,
    fontSize: sf(13),
    fontWeight: '800',
  },
  saveButton: {
    flex: 1,
    minHeight: sv(46),
    borderRadius: s(15),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.gold,
  },
  saveButtonDisabled: {
    opacity: 0.48,
  },
  saveButtonPrepared: {
    opacity: 0.68,
  },
  saveButtonText: {
    color: COLORS.black,
    fontSize: sf(13),
    fontWeight: '900',
  },
});
