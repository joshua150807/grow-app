import { logger } from '../../lib/logger';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
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

export default function ResetPasswordScreen() {
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [successText, setSuccessText] = useState('');
  const [hasSession, setHasSession] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (isMountedRef.current) {
        setHasSession(Boolean(data.session?.user?.id));
      }
    });

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  async function handleResetPassword() {
    Keyboard.dismiss();
    setErrorText('');
    setSuccessText('');

    if (!password || !password2) {
      setErrorText('Bitte beide Passwortfelder ausfüllen.');
      return;
    }

    if (password.length < 6) {
      setErrorText('Das Passwort muss mindestens 6 Zeichen haben.');
      return;
    }

    if (password !== password2) {
      setErrorText('Passwörter stimmen nicht überein.');
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        logger.debug('PASSWORD UPDATE ERROR:', error);
        setErrorText('Passwort konnte nicht geändert werden. Öffne den Link bitte erneut.');
        return;
      }

      setSuccessText('Passwort geändert. Du wirst jetzt eingeloggt.');

      setTimeout(() => {
        router.replace('/(tabs)');
      }, 700);
    } catch (err) {
      logger.debug('PASSWORD RESET ERROR:', err);
      setErrorText('Passwort konnte nicht geändert werden.');
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }

  return (
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
            <Text style={styles.subtitle}>Neues Passwort setzen</Text>

            {!hasSession && (
              <View style={styles.infoBox}>
                <Text style={styles.infoText}>
                  Falls du diese Seite manuell geöffnet hast, fehlt der Recovery-Link. Öffne bitte
                  den Link aus deiner E-Mail.
                </Text>
              </View>
            )}

            <Text style={styles.label}>Neues Passwort</Text>
            <View style={styles.passwordWrap}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Neues Passwort"
                placeholderTextColor={COLORS.textMuted}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                style={styles.passwordInput}
              />

              <Pressable
                onPress={() => setShowPassword((current) => !current)}
                hitSlop={10}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={22}
                  color={COLORS.gold}
                />
              </Pressable>
            </View>

            <Text style={styles.label}>Passwort wiederholen</Text>
            <TextInput
              value={password2}
              onChangeText={setPassword2}
              placeholder="Passwort wiederholen"
              placeholderTextColor={COLORS.textMuted}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleResetPassword}
              style={styles.input}
            />

            {!!errorText && <Text style={styles.error}>{errorText}</Text>}
            {!!successText && <Text style={styles.success}>{successText}</Text>}

            <Pressable
              style={({ pressed }) => [
                styles.button,
                pressed && !loading && styles.buttonPressed,
                loading && styles.buttonDisabled,
              ]}
              onPress={handleResetPassword}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.black} />
              ) : (
                <Text style={styles.buttonText}>Passwort speichern</Text>
              )}
            </Pressable>

            <Pressable
              style={styles.loginLink}
              onPress={() => {
                Keyboard.dismiss();
                router.replace('/(auth)/login');
              }}
            >
              <Text style={styles.loginText}>Zurück zum Login</Text>
            </Pressable>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
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
    marginBottom: sv(6),
  },
  subtitle: {
    color: COLORS.textPrimary,
    fontSize: sf(15),
    textAlign: 'center',
    marginBottom: sv(24),
  },
  infoBox: {
    backgroundColor: COLORS.black,
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    borderRadius: s(16),
    padding: s(14),
    marginBottom: sv(16),
  },
  infoText: {
    color: COLORS.textSecondary,
    fontSize: sf(13),
    lineHeight: sf(19),
  },
  label: {
    color: COLORS.softGold,
    fontSize: sf(13),
    fontWeight: '700',
    marginBottom: sv(8),
    marginTop: sv(12),
  },
  input: {
    backgroundColor: COLORS.black,
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    borderRadius: s(14),
    color: COLORS.white,
    paddingHorizontal: s(14),
    paddingVertical: sv(13),
    fontSize: sf(15),
  },
  passwordWrap: {
    backgroundColor: COLORS.black,
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    borderRadius: s(14),
    paddingHorizontal: s(14),
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    color: COLORS.white,
    paddingVertical: sv(13),
    fontSize: sf(15),
  },
  error: {
    color: COLORS.errorLight,
    marginTop: sv(14),
    fontSize: sf(13),
    textAlign: 'center',
  },
  success: {
    color: COLORS.lightGold,
    marginTop: sv(14),
    fontSize: sf(13),
    lineHeight: sf(18),
    textAlign: 'center',
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
    fontSize: sf(16),
    fontWeight: '800',
  },
  loginLink: {
    marginTop: sv(16),
    alignItems: 'center',
  },
  loginText: {
    color: COLORS.lightGold,
    fontSize: sf(13),
    fontWeight: '800',
  },
});
