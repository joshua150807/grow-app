import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS } from '../../../constants/colors';
import { s, sf, sv } from '../../../constants/layout';
import { logoutCurrentUser } from '../../../services/authSession';
import { useOnboarding } from '../../onboarding/context/OnboardingContext';
import {
  changeCurrentUserPassword,
  validatePasswordChange,
} from '../services/profilePassword';

const EMPTY_PASSWORDS = { currentPassword: '', newPassword: '', confirmPassword: '' };

function passwordMessage(code) {
  switch (code) {
    case 'PASSWORD_FIELDS_REQUIRED': return 'Bitte fülle alle Passwortfelder aus.';
    case 'PASSWORD_TOO_SHORT': return 'Das neue Passwort muss mindestens 6 Zeichen haben.';
    case 'PASSWORD_CONFIRMATION_MISMATCH': return 'Die neuen Passwörter stimmen nicht überein.';
    case 'PASSWORD_UNCHANGED': return 'Das neue Passwort muss sich vom aktuellen unterscheiden.';
    case 'PASSWORD_CURRENT_INVALID': return 'Das aktuelle Passwort ist nicht korrekt.';
    case 'PASSWORD_SESSION_MISSING': return 'Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.';
    case 'PASSWORD_EMAIL_MISSING': return 'Für dieses Konto ist keine E-Mail hinterlegt.';
    case 'PASSWORD_PROVIDER_UNSUPPORTED': return 'Für dieses Konto kann hier kein Passwort geändert werden.';
    case 'PASSWORD_REAUTH_USER_MISMATCH':
    case 'PASSWORD_AUTH_CHANGED': return 'Die aktive Sitzung hat sich geändert. Bitte versuche es erneut.';
    case 'PASSWORD_UPDATE_FAILED': return 'Das Passwort konnte nicht geändert werden.';
    default: return 'Das Passwort konnte nicht geändert werden.';
  }
}

function SettingsRow({ icon, label, onPress, disabled = false, destructive = false, loading = false }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={({ pressed }) => [styles.row, (disabled || loading) && styles.disabled, pressed && styles.pressed]}
    >
      <View style={[styles.rowIcon, destructive && styles.rowIconDanger]}>
        <Ionicons name={icon} size={s(19)} color={destructive ? COLORS.errorLight : COLORS.softGold} />
      </View>
      <Text style={[styles.rowLabel, destructive && styles.dangerText]}>{label}</Text>
      {loading ? (
        <ActivityIndicator color={destructive ? COLORS.errorLight : COLORS.gold} />
      ) : (
        <Ionicons name="chevron-forward" size={s(18)} color={COLORS.textFaint} />
      )}
    </Pressable>
  );
}

export default function ProfileSettingsScreen() {
  const insets = useSafeAreaInsets();
  const { startTutorial } = useOnboarding();
  const [passwords, setPasswords] = useState(EMPTY_PASSWORDS);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const passwordFlightRef = useRef(false);
  const logoutFlightRef = useRef(false);

  function setPasswordField(field, value) {
    setPasswords((current) => ({ ...current, [field]: value }));
    setPasswordError('');
    setPasswordSuccess('');
  }

  async function handlePasswordChange() {
    if (passwordFlightRef.current) return;

    const validationError = validatePasswordChange(passwords);
    if (validationError) {
      setPasswordError(passwordMessage(validationError));
      return;
    }

    passwordFlightRef.current = true;
    setIsChangingPassword(true);
    setPasswordError('');
    setPasswordSuccess('');

    try {
      await changeCurrentUserPassword(passwords);
      setPasswords(EMPTY_PASSWORDS);
      setPasswordSuccess('Dein Passwort wurde erfolgreich geändert.');
    } catch (error) {
      setPasswordError(passwordMessage(error?.code));
    } finally {
      passwordFlightRef.current = false;
      setIsChangingPassword(false);
    }
  }

  async function performLogout() {
    if (logoutFlightRef.current) return;
    logoutFlightRef.current = true;
    setIsLoggingOut(true);

    try {
      await logoutCurrentUser();
    } catch {
      logoutFlightRef.current = false;
      setIsLoggingOut(false);
      Alert.alert('Logout fehlgeschlagen', 'Bitte versuche es erneut.');
    }
  }

  function confirmLogout() {
    if (isLoggingOut) return;
    Alert.alert('Abmelden?', 'Möchtest du dich wirklich abmelden?', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: performLogout },
    ]);
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: Math.max(insets.top, sv(12)),
          paddingBottom: Math.max(insets.bottom, sv(20)) + sv(24),
        }}
      >
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Zurück" onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={s(23)} color={COLORS.softGold} />
          </Pressable>
          <View>
            <Text style={styles.title}>Einstellungen</Text>
            <Text style={styles.subtitle}>Profil, App und Sitzung</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>KONTO</Text>
        <View style={styles.card}>
          <Text style={styles.passwordTitle}>Passwort ändern</Text>
          <Text style={styles.passwordHint}>Bestätige zuerst dein aktuelles Passwort.</Text>
          <TextInput
            value={passwords.currentPassword}
            onChangeText={(value) => setPasswordField('currentPassword', value)}
            placeholder="Aktuelles Passwort"
            placeholderTextColor={COLORS.textFaint}
            secureTextEntry
            editable={!isChangingPassword}
            style={styles.input}
          />
          <TextInput
            value={passwords.newPassword}
            onChangeText={(value) => setPasswordField('newPassword', value)}
            placeholder="Neues Passwort"
            placeholderTextColor={COLORS.textFaint}
            secureTextEntry
            editable={!isChangingPassword}
            style={styles.input}
          />
          <TextInput
            value={passwords.confirmPassword}
            onChangeText={(value) => setPasswordField('confirmPassword', value)}
            placeholder="Neues Passwort bestätigen"
            placeholderTextColor={COLORS.textFaint}
            secureTextEntry
            editable={!isChangingPassword}
            style={styles.input}
          />
          {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
          {passwordSuccess ? <Text style={styles.successText}>{passwordSuccess}</Text> : null}
          <Pressable
            onPress={handlePasswordChange}
            disabled={isChangingPassword}
            style={({ pressed }) => [styles.primaryButton, isChangingPassword && styles.disabled, pressed && styles.pressed]}
          >
            {isChangingPassword ? <ActivityIndicator color={COLORS.black} /> : <Text style={styles.primaryButtonText}>Passwort speichern</Text>}
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>APP</Text>
        <View style={styles.card}>
          <SettingsRow icon="sparkles-outline" label="Tutorial erneut anzeigen" onPress={() => startTutorial()} />
        </View>

        <Text style={styles.sectionTitle}>RECHTLICHES</Text>
        <View style={styles.card}>
          <SettingsRow icon="shield-checkmark-outline" label="Datenschutz" onPress={() => router.push('/(tabs)/tools/privacy')} />
          <View style={styles.divider} />
          <SettingsRow icon="information-circle-outline" label="Impressum" onPress={() => router.push('/(tabs)/tools/imprint')} />
        </View>

        <Text style={styles.sectionTitle}>SITZUNG</Text>
        <View style={[styles.card, styles.logoutCard]}>
          <SettingsRow icon="log-out-outline" label="Logout" onPress={confirmLogout} destructive loading={isLoggingOut} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: s(20), marginBottom: sv(28) },
  backButton: { width: s(44), height: s(44), alignItems: 'center', justifyContent: 'center', marginRight: s(10), borderRadius: s(22), borderWidth: 1, borderColor: COLORS.goldBorder, backgroundColor: COLORS.darkCard },
  title: { color: COLORS.paleGold, fontSize: sf(25), fontWeight: '900' },
  subtitle: { marginTop: sv(2), color: COLORS.textDim, fontSize: sf(12) },
  sectionTitle: { marginTop: sv(18), marginBottom: sv(8), paddingHorizontal: s(22), color: COLORS.mutedGold, fontSize: sf(11), fontWeight: '900', letterSpacing: 1.2 },
  card: { marginHorizontal: s(18), borderRadius: s(20), borderWidth: 1, borderColor: COLORS.goldBorder, backgroundColor: COLORS.darkCard, overflow: 'hidden' },
  passwordTitle: { paddingHorizontal: s(18), paddingTop: sv(18), color: COLORS.softGold, fontSize: sf(16), fontWeight: '800' },
  passwordHint: { paddingHorizontal: s(18), marginTop: sv(4), marginBottom: sv(10), color: COLORS.textDim, fontSize: sf(11.5) },
  input: { minHeight: sv(50), marginHorizontal: s(16), marginTop: sv(10), paddingHorizontal: s(15), borderRadius: s(15), borderWidth: 1, borderColor: COLORS.borderMid, backgroundColor: COLORS.backgroundDeep, color: COLORS.textPrimary, fontSize: sf(14) },
  errorText: { marginHorizontal: s(18), marginTop: sv(10), color: COLORS.errorLight, fontSize: sf(11.5) },
  successText: { marginHorizontal: s(18), marginTop: sv(10), color: COLORS.softGold, fontSize: sf(11.5) },
  primaryButton: { minHeight: sv(49), margin: s(16), alignItems: 'center', justifyContent: 'center', borderRadius: s(15), backgroundColor: COLORS.warmGold },
  primaryButtonText: { color: COLORS.black, fontSize: sf(13), fontWeight: '900' },
  row: { minHeight: sv(62), flexDirection: 'row', alignItems: 'center', paddingHorizontal: s(16) },
  rowIcon: { width: s(36), height: s(36), alignItems: 'center', justifyContent: 'center', borderRadius: s(12), backgroundColor: 'rgba(126,82,170,0.16)' },
  rowIconDanger: { backgroundColor: 'rgba(212,106,106,0.12)' },
  rowLabel: { flex: 1, marginLeft: s(12), color: COLORS.textSecondary, fontSize: sf(14), fontWeight: '700' },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: s(64), backgroundColor: COLORS.borderSubtle },
  logoutCard: { borderColor: 'rgba(212,106,106,0.24)' },
  dangerText: { color: COLORS.errorLight },
  disabled: { opacity: 0.48 },
  pressed: { opacity: 0.76 },
});
