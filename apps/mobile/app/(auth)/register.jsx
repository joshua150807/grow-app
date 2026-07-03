import { logger } from '../../lib/logger';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { supabase } from '../../services/supabaseClient';
import { COLORS } from '../../constants/colors';
import { s, sv, sf } from '../../constants/layout';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-z0-9_\.]{3,24}$/;

export default function RegisterScreen() {
  const [username, setUsername] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [showRecoveryInfo, setShowRecoveryInfo] = useState(false);
  const isMountedRef = useRef(true);
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  function showError(message) {
    if (isMountedRef.current) {
      setErrorText(message);
    }
  }

  function getRegistrationErrorMessage(status, fallback = 'Registrierung fehlgeschlagen.') {
    switch (status) {
      case 'USERNAME_TAKEN':
        return 'Username ist bereits vergeben.';
      case 'EMAIL_TAKEN':
        return 'Diese Recovery-Mail ist bereits für einen Account vergeben.';
      case 'CODE_INVALID':
        return 'Ungültiger oder bereits genutzter Beta-Code.';
      case 'INVALID_INPUT':
        return 'Bitte prüfe deine Eingaben.';
      case 'DUPLICATE_DATA':
        return 'Username, Recovery-Mail oder Beta-Code ist bereits vergeben.';
      case 'NOT_ALLOWED':
        return 'Registrierung konnte nicht bestätigt werden. Bitte versuche es erneut.';
      default:
        return fallback;
    }
  }

  async function handleRegister() {
    if (isSubmittingRef.current) return;

    Keyboard.dismiss();
    showError('');

    const cleanUsername = username.trim().toLowerCase();
    const cleanRecoveryEmail = recoveryEmail.trim().toLowerCase();
    const cleanCode = code.trim().toUpperCase();

    if (!cleanUsername || !cleanRecoveryEmail || !password || !password2 || !cleanCode) {
      showError('Bitte alle Felder ausfüllen.');
      return;
    }

    if (!USERNAME_REGEX.test(cleanUsername)) {
      showError('Username: 3–24 Zeichen, nur Buchstaben, Zahlen, Punkt oder Unterstrich.');
      return;
    }

    if (!EMAIL_REGEX.test(cleanRecoveryEmail)) {
      showError('Bitte eine gültige Recovery-Mail eingeben.');
      return;
    }

    if (password !== password2) {
      showError('Passwörter stimmen nicht überein.');
      return;
    }

    try {
      isSubmittingRef.current = true;
      setLoading(true);

      const { data: validationStatus, error: validationError } = await supabase.rpc(
        'validate_beta_registration',
        {
          input_code: cleanCode,
          input_username: cleanUsername,
          input_recovery_email: cleanRecoveryEmail,
        }
      );

      if (validationError) {
        logger.debug('REGISTRATION VALIDATION ERROR:', validationError);
        showError('Registrierung konnte nicht geprüft werden.');
        return;
      }

      if (validationStatus !== 'OK') {
        showError(getRegistrationErrorMessage(validationStatus));
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: cleanRecoveryEmail,
        password,
        options: {
          data: {
            username: cleanUsername,
          },
        },
      });

      if (error || !data.user) {
        const message = error?.message?.toLowerCase() || '';

        if (message.includes('already registered') || message.includes('already been registered')) {
          showError('Diese Recovery-Mail ist bereits für einen Account vergeben.');
        } else if (message.includes('password')) {
          showError('Passwort ist zu schwach oder zu kurz.');
        } else if (message.includes('rate limit')) {
          showError('Zu viele Versuche. Bitte warte kurz und versuche es später erneut.');
        } else {
          showError('Registrierung fehlgeschlagen. Bitte prüfe deine Eingaben.');
        }

        return;
      }

      const { data: completionStatus, error: completionError } = await supabase.rpc(
        'complete_beta_registration',
        {
          input_code: cleanCode,
          input_user_id: data.user.id,
          input_username: cleanUsername,
          input_recovery_email: cleanRecoveryEmail,
        }
      );

      if (completionError) {
        logger.debug('REGISTRATION COMPLETION ERROR:', completionError);
        showError('Registrierung konnte nicht abgeschlossen werden.');
        return;
      }

      if (completionStatus !== 'OK') {
        showError(getRegistrationErrorMessage(completionStatus));
        return;
      }

      router.replace('/(tabs)');
    } catch (err) {
      logger.debug('REGISTER ERROR:', err);
      showError('Registrierung fehlgeschlagen.');
    } finally {
      isSubmittingRef.current = false;
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }

  return (
    <>
      <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <Text style={styles.logo}>Grow</Text>
            <Text style={styles.subtitle}>Beta Zugang erstellen</Text>

            <TextInput
              style={styles.input}
              placeholder="Username"
              placeholderTextColor={COLORS.textMuted}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />

            <View style={styles.recoveryInputWrap}>
              <TextInput
                style={styles.recoveryInput}
                placeholder="Recovery-Mail"
                placeholderTextColor={COLORS.textMuted}
                value={recoveryEmail}
                onChangeText={setRecoveryEmail}
                keyboardType="email-address"
                textContentType="emailAddress"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />

              <Pressable
                style={styles.recoveryInfoButton}
                onPress={() => {
                  Keyboard.dismiss();
                  setShowRecoveryInfo(true);
                }}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Informationen zur Recovery-Mail"
              >
                <Text style={styles.recoveryInfoButtonText}>?</Text>
              </Pressable>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Beta Code"
              placeholderTextColor={COLORS.textMuted}
              value={code}
              onChangeText={setCode}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="next"
            />

            <View style={styles.passwordWrap}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Passwort"
                placeholderTextColor={COLORS.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />
              <Pressable onPress={() => setShowPassword((current) => !current)} hitSlop={10}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={22}
                  color={COLORS.gold}
                />
              </Pressable>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Passwort wiederholen"
              placeholderTextColor={COLORS.textMuted}
              value={password2}
              onChangeText={setPassword2}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleRegister}
            />

            {!!errorText && <Text style={styles.error}>{errorText}</Text>}

            <Pressable
              style={({ pressed }) => [
                styles.button,
                pressed && !loading && styles.buttonPressed,
                loading && styles.buttonDisabled,
              ]}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.black} />
              ) : (
                <Text style={styles.buttonText}>Registrieren</Text>
              )}
            </Pressable>

            <Pressable
              onPress={() => {
                Keyboard.dismiss();
                router.push('/(auth)/login');
              }}
            >
              <Text style={styles.link}>
                Bereits Account? <Text style={styles.gold}>Einloggen</Text>
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      <Modal
        visible={showRecoveryInfo}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRecoveryInfo(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setShowRecoveryInfo(false)}
        >
          <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.modalTitle}>Wofür brauchen wir deine E-Mail?</Text>
            <Text style={styles.modalText}>
              Wir benötigen deine E-Mail-Adresse ausschließlich, damit du dein Passwort
              zurücksetzen und deinen Account wiederherstellen kannst. Ohne deine ausdrückliche
              Zustimmung senden wir dir keine Werbung oder sonstigen Nachrichten.
            </Text>

            <Pressable
              style={({ pressed }) => [styles.modalButton, pressed && styles.buttonPressed]}
              onPress={() => setShowRecoveryInfo(false)}
            >
              <Text style={styles.modalButtonText}>Verstanden</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: s(24),
    paddingVertical: sv(28),
  },
  card: {
    backgroundColor: COLORS.darkCard,
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    borderRadius: s(24),
    padding: s(22),
  },
  logo: {
    color: COLORS.gold,
    fontSize: sf(42),
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: COLORS.textPrimary,
    textAlign: 'center',
    fontSize: sf(15),
    marginBottom: sv(22),
    marginTop: sv(6),
  },
  input: {
    backgroundColor: COLORS.black,
    color: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    borderRadius: s(14),
    padding: s(14),
    marginTop: sv(12),
    fontSize: sf(15),
  },
  recoveryInputWrap: {
    backgroundColor: COLORS.black,
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    borderRadius: s(14),
    paddingLeft: s(14),
    paddingRight: s(10),
    marginTop: sv(12),
    flexDirection: 'row',
    alignItems: 'center',
  },
  recoveryInput: {
    flex: 1,
    color: COLORS.white,
    paddingVertical: sv(14),
    paddingRight: s(10),
    fontSize: sf(15),
  },
  recoveryInfoButton: {
    width: s(28),
    height: s(28),
    borderRadius: s(14),
    borderWidth: 1,
    borderColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recoveryInfoButtonText: {
    color: COLORS.gold,
    fontSize: sf(16),
    fontWeight: '900',
  },
  passwordWrap: {
    backgroundColor: COLORS.black,
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    borderRadius: s(14),
    paddingHorizontal: s(14),
    marginTop: sv(12),
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    color: COLORS.white,
    paddingVertical: sv(14),
    fontSize: sf(15),
  },
  button: {
    backgroundColor: COLORS.gold,
    borderRadius: s(16),
    paddingVertical: sv(14),
    alignItems: 'center',
    marginTop: sv(22),
  },
  buttonPressed: {
    opacity: 0.82,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: COLORS.black,
    fontWeight: '800',
    fontSize: sf(16),
  },
  error: {
    color: COLORS.errorLight,
    marginTop: sv(12),
    textAlign: 'center',
  },
  link: {
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: sv(18),
    fontSize: sf(13),
  },
  gold: {
    color: COLORS.gold,
    fontWeight: '900',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    paddingHorizontal: s(24),
  },
  modalCard: {
    backgroundColor: COLORS.darkCard,
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    borderRadius: s(20),
    padding: s(22),
  },
  modalTitle: {
    color: COLORS.gold,
    fontSize: sf(19),
    fontWeight: '800',
    marginBottom: sv(12),
  },
  modalText: {
    color: COLORS.textPrimary,
    fontSize: sf(14),
    lineHeight: sf(21),
  },
  modalButton: {
    backgroundColor: COLORS.gold,
    borderRadius: s(14),
    paddingVertical: sv(12),
    alignItems: 'center',
    marginTop: sv(20),
  },
  modalButtonText: {
    color: COLORS.black,
    fontSize: sf(15),
    fontWeight: '800',
  },
});
