import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
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
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS } from '../../../constants/colors';
import { s, sf, sv } from '../../../constants/layout';
import { useToolsTrackerData } from '../../tools/overview/hooks/useToolsTrackerData';
import ProfilePremiumCanvas from '../components/ProfilePremiumCanvas';
import { useProfile } from '../hooks/useProfile';
import { useProfileAvatar } from '../hooks/useProfileAvatar';
import { useProfileStats } from '../hooks/useProfileStats';
import { isProfileApiV1Enabled, updateMyProfileV1 } from '../services/profiles';

const PROFILE_MOTTO = 'Bereit für den nächsten klaren Schritt.';
const MOCK_GROW_COINS = 0;
const PROFILE_STATS_MOCKS = { trainings: '0', goals: '0', plannedDays: '0' };
const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;
const TAB_BAR_HEIGHT = sv(68);
const TAB_BAR_DEFAULT_BOTTOM = 1;
const SAMSUNG_LARGE_NAV_INSET_THRESHOLD = 32;
const IS_SAMSUNG_ANDROID =
  Platform.OS === 'android'
  && String(Platform.constants?.Manufacturer ?? '').toLowerCase() === 'samsung';

function getProfileSaveErrorMessage(error) {
  switch (error?.code) {
    case 'USERNAME_TAKEN':
      return 'Dieser Benutzername ist bereits vergeben.';
    case 'PROFILE_NOT_FOUND':
      return 'Dein Profil konnte nicht gefunden werden.';
    case 'UNAUTHORIZED':
    case 'PROFILE_API_SESSION_ERROR':
    case 'PROFILE_API_SESSION_MISSING':
      return 'Deine Sitzung ist nicht mehr gültig. Bitte melde dich erneut an.';
    case 'PROFILE_API_NETWORK_ERROR':
      return 'Verbindung zum Server fehlgeschlagen.';
    case 'VALIDATION_ERROR':
      return 'Bitte prüfe Benutzername und Bio.';
    default:
      return 'Profil konnte nicht aktualisiert werden.';
  }
}

function formatNumber(value) {
  return Math.max(0, Number(value ?? 0) || 0).toLocaleString('de-DE');
}

function formatDeepWork(seconds) {
  const minutes = Math.floor(Math.max(0, Number(seconds ?? 0) || 0) / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function validateUsername(value) {
  const normalized = value.trim().toLowerCase();
  if (normalized.length < 3) return 'Mindestens 3 Zeichen.';
  if (normalized.length > 30) return 'Maximal 30 Zeichen.';
  if (!USERNAME_REGEX.test(normalized)) return 'Nur Buchstaben, Zahlen und Unterstrich.';
  return '';
}

function ProfileEditModal({
  visible,
  username,
  bio,
  isSaving,
  saveError,
  isV1Enabled,
  onClose,
  onDraftChange,
  onSave,
}) {
  const insets = useSafeAreaInsets();
  const [usernameDraft, setUsernameDraft] = useState(username);
  const [bioDraft, setBioDraft] = useState(bio);
  const wasVisibleRef = useRef(false);
  const normalizedUsername = usernameDraft.trim().toLowerCase();
  const normalizedBio = bioDraft.trim();
  const usernameError = validateUsername(usernameDraft);
  const usernameChanged = normalizedUsername !== username.trim().toLowerCase();
  const bioChanged = normalizedBio !== bio;
  const canSave = isV1Enabled && !usernameError && (usernameChanged || bioChanged) && !isSaving;
  const message = usernameError || saveError || `Zielwert: ${normalizedUsername}`;

  useEffect(() => {
    if (visible && !wasVisibleRef.current) {
      setUsernameDraft(username);
      setBioDraft(bio);
    }
    wasVisibleRef.current = visible;
  }, [bio, username, visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : sv(18)}
        style={styles.modalRoot}
      >
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={[styles.editSheet, { paddingBottom: Math.max(insets.bottom + sv(16), sv(28)) }]}>
          <ScrollView
            bounces={false}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.editSheetContent}
          >
            <View style={styles.editHandle} />
            <Text style={styles.editTitle}>Profil bearbeiten</Text>
            <Text style={styles.editSubtitle}>Passe deinen Benutzernamen und deine Bio an.</Text>

            <Text style={styles.inputLabel}>Username</Text>
            <TextInput
              value={usernameDraft}
              onChangeText={(value) => { setUsernameDraft(value); onDraftChange?.(); }}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={30}
              returnKeyType="done"
              placeholder="username"
              placeholderTextColor={COLORS.textFaint}
              style={[styles.usernameInput, Boolean(usernameError) && styles.usernameInputError]}
            />
            <View style={styles.editMetaRow}>
              <Text style={[styles.editHint, Boolean(usernameError || saveError) && styles.editError]}>
                {message}
              </Text>
              <Text style={styles.charCount}>{normalizedUsername.length}/30</Text>
            </View>

            <Text style={styles.inputLabel}>Bio</Text>
            <TextInput
              value={bioDraft}
              onChangeText={(value) => { setBioDraft(value); onDraftChange?.(); }}
              autoCapitalize="sentences"
              autoCorrect
              maxLength={100}
              multiline
              numberOfLines={3}
              placeholder="Erzähle kurz etwas über dich"
              placeholderTextColor={COLORS.textFaint}
              style={[styles.usernameInput, styles.bioInput]}
            />
            <View style={styles.editMetaRow}>
              <Text style={styles.editHint}>Maximal 100 Zeichen.</Text>
              <Text style={styles.charCount}>{bioDraft.length}/100</Text>
            </View>

            <View style={styles.editActions}>
              <Pressable onPress={onClose} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
                <Text style={styles.secondaryButtonText}>Schließen</Text>
              </Pressable>
              <Pressable
                disabled={!canSave}
                onPress={() => onSave({
                  ...(usernameChanged ? { username: normalizedUsername } : {}),
                  ...(bioChanged ? { bio: normalizedBio } : {}),
                })}
                accessibilityState={{ disabled: !canSave }}
                style={[styles.saveButton, !canSave && styles.saveButtonDisabled, canSave && styles.saveButtonPrepared]}
              >
                <Text style={styles.saveButtonText}>{isSaving ? 'Speichern...' : 'Speichern'}</Text>
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
  const { width } = useWindowDimensions();
  const { username, bio, avatarUrl, growPoints, reloadProfile } = useProfile();
  const { streak, todoProgress, deepWorkTime } = useToolsTrackerData();
  const profileStats = useProfileStats({
    habitStreak: streak,
    todosToday: todoProgress,
    deepWorkSecondsAllTime: deepWorkTime,
    trainingSessions: Number(PROFILE_STATS_MOCKS.trainings),
    goals: Number(PROFILE_STATS_MOCKS.goals),
    plannedDaysCurrentWeek: Number(PROFILE_STATS_MOCKS.plannedDays),
  });
  const [editVisible, setEditVisible] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSaveError, setProfileSaveError] = useState('');
  const [avatarImageFailed, setAvatarImageFailed] = useState(false);
  const isMountedRef = useRef(true);
  const avatarReloadAttemptedRef = useRef(false);
  const hasFocusedProfileRef = useRef(false);
  const profileApiV1Enabled = isProfileApiV1Enabled();
  const {
    hasConfirmedAvatarReset,
    isAvatarEditingEnabled,
    isResettingAvatar,
    isUpdatingAvatar,
    showAvatarActions,
  } = useProfileAvatar({ avatarUrl, reloadProfile });
  const hasRemoteAvatar = profileApiV1Enabled
    && typeof avatarUrl === 'string'
    && avatarUrl.trim().length > 0
    && !avatarImageFailed
    && !hasConfirmedAvatarReset
    && !isResettingAvatar;

  useEffect(() => () => { isMountedRef.current = false; }, []);
  useEffect(() => { setAvatarImageFailed(false); }, [avatarUrl]);

  useFocusEffect(useCallback(() => {
    avatarReloadAttemptedRef.current = false;
    if (!hasFocusedProfileRef.current) {
      hasFocusedProfileRef.current = true;
    } else if (profileApiV1Enabled) {
      reloadProfile?.().catch(() => {});
    }
  }, [profileApiV1Enabled, reloadProfile]));

  const handleAvatarImageError = useCallback(() => {
    setAvatarImageFailed(true);
    if (!profileApiV1Enabled || avatarReloadAttemptedRef.current) return;
    avatarReloadAttemptedRef.current = true;
    reloadProfile?.().catch(() => {});
  }, [profileApiV1Enabled, reloadProfile]);

  async function handleProfileSave(changes) {
    if (!profileApiV1Enabled || isSavingProfile) return;
    setProfileSaveError('');
    setIsSavingProfile(true);
    try {
      await updateMyProfileV1(changes);
      await reloadProfile?.();
      if (!isMountedRef.current) return;
      setProfileSaveError('');
      setEditVisible(false);
    } catch (error) {
      if (isMountedRef.current) setProfileSaveError(getProfileSaveErrorMessage(error));
    } finally {
      if (isMountedRef.current) setIsSavingProfile(false);
    }
  }

  function handleEditClose() {
    if (isSavingProfile) return;
    setProfileSaveError('');
    setEditVisible(false);
  }

  const todoStatsValue = Number.isInteger(profileStats.todosCompletedAllTime)
    ? String(profileStats.todosCompletedAllTime)
    : `${profileStats.todosToday.completed}/${profileStats.todosToday.total}`;
  const statItems = useMemo(() => [
    { icon: 'fire', value: String(profileStats.habitStreak), label: 'Streak' },
    { icon: 'check-circle-outline', value: todoStatsValue, label: 'To-dos abgeschlossen' },
    { icon: 'brain', value: formatDeepWork(profileStats.deepWorkSecondsAllTime), label: 'Deep Work' },
    { icon: 'dumbbell', value: String(profileStats.trainingSessions), label: 'Trainings' },
    { icon: 'flag-outline', value: String(profileStats.goals), label: 'Ziele definiert' },
    { icon: 'calendar-month-outline', value: String(profileStats.plannedDaysCurrentWeek), label: 'Tage geplant' },
  ], [profileStats, todoStatsValue]);

  const tabBarBottom = IS_SAMSUNG_ANDROID && insets.bottom > SAMSUNG_LARGE_NAV_INSET_THRESHOLD
    ? insets.bottom
    : TAB_BAR_DEFAULT_BOTTOM;
  const bottomNavReserve = TAB_BAR_HEIGHT + tabBarBottom;

  return (
    <View style={styles.screen}>
      <ProfilePremiumCanvas
        availableWidth={width}
        topPadding={Math.max(insets.top, sv(4))}
        bottomPadding={bottomNavReserve + sv(8)}
        username={username}
        bio={profileApiV1Enabled ? bio : PROFILE_MOTTO}
        avatarUrl={avatarUrl}
        hasRemoteAvatar={hasRemoteAvatar}
        isAvatarEditingEnabled={isAvatarEditingEnabled}
        isUpdatingAvatar={isUpdatingAvatar}
        onAvatarPress={showAvatarActions}
        onAvatarError={handleAvatarImageError}
        growPoints={formatNumber(growPoints)}
        growCoins={formatNumber(MOCK_GROW_COINS)}
        stats={statItems}
        onEditProfile={() => { setProfileSaveError(''); setEditVisible(true); }}
      />
      <ProfileEditModal
        visible={editVisible}
        username={username}
        bio={bio}
        isSaving={isSavingProfile}
        saveError={profileSaveError}
        isV1Enabled={profileApiV1Enabled}
        onClose={handleEditClose}
        onDraftChange={() => { if (profileSaveError) setProfileSaveError(''); }}
        onSave={handleProfileSave}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.62)' },
  editSheet: {
    maxHeight: '76%',
    borderTopLeftRadius: s(28),
    borderTopRightRadius: s(28),
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: COLORS.goldBorder,
    backgroundColor: COLORS.darkCard,
  },
  editSheetContent: { paddingHorizontal: s(22), paddingTop: sv(12) },
  editHandle: {
    alignSelf: 'center',
    width: s(48),
    height: sv(4),
    borderRadius: s(999),
    backgroundColor: COLORS.goldBorderLight,
    marginBottom: sv(18),
  },
  editTitle: { color: COLORS.paleGold, fontSize: sf(23), fontWeight: '900' },
  editSubtitle: { marginTop: sv(5), color: COLORS.textDim, fontSize: sf(12), lineHeight: sf(17) },
  inputLabel: { marginTop: sv(20), marginBottom: sv(8), color: COLORS.softGold, fontSize: sf(12), fontWeight: '800' },
  usernameInput: {
    minHeight: sv(50),
    borderRadius: s(16),
    borderWidth: 1,
    borderColor: COLORS.borderMid,
    backgroundColor: COLORS.backgroundDeep,
    paddingHorizontal: s(15),
    color: COLORS.textPrimary,
    fontSize: sf(15),
  },
  usernameInputError: { borderColor: COLORS.error },
  bioInput: { minHeight: sv(92), paddingTop: sv(13), textAlignVertical: 'top' },
  editMetaRow: { flexDirection: 'row', justifyContent: 'space-between', gap: s(12), marginTop: sv(7) },
  editHint: { flex: 1, color: COLORS.textFaint, fontSize: sf(10.5) },
  editError: { color: COLORS.errorLight },
  charCount: { color: COLORS.textFaint, fontSize: sf(10.5) },
  editActions: { flexDirection: 'row', gap: s(10), marginTop: sv(24) },
  secondaryButton: {
    flex: 1,
    minHeight: sv(48),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: s(16),
    borderWidth: 1,
    borderColor: COLORS.borderMid,
  },
  secondaryButtonText: { color: COLORS.textSecondary, fontSize: sf(13), fontWeight: '800' },
  saveButton: {
    flex: 1,
    minHeight: sv(48),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: s(16),
    borderWidth: 1,
    borderColor: COLORS.goldBorderLight,
    backgroundColor: COLORS.dimGold,
  },
  saveButtonPrepared: { backgroundColor: COLORS.warmGold },
  saveButtonDisabled: { opacity: 0.38 },
  saveButtonText: { color: COLORS.black, fontSize: sf(13), fontWeight: '900' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});
