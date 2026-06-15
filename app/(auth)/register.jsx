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

      const { data: usernameAvailable, error: usernameError } = await supabase.rpc(
        'is_username_available',
        {
          input_username: cleanUsername,
        }
      );

      if (usernameError) {
        console.log('USERNAME CHECK ERROR:', usernameError);
        showError('Username konnte nicht geprüft werden.');
        return;
      }

      if (!usernameAvailable) {
        showError('Username ist bereits vergeben.');
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

      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        username: cleanUsername,
        recovery_email: cleanRecoveryEmail,
        grow_points: 0,
      });

      if (profileError) {
        console.log('PROFILE ERROR:', profileError);

        if (profileError.code === '23505') {
          showError('Username oder Recovery-Mail ist bereits vergeben.');
        } else {
          showError(profileError.message);
        }

        return;
      }

      const { data: claimed, error: claimError } = await supabase.rpc('claim_beta_code', {
        input_code: cleanCode,
        input_user_id: data.user.id,
      });

      if (claimError || !claimed) {
        console.log('BETA CLAIM ERROR:', claimError);
        showError('Ungültiger oder bereits genutzter Beta-Code.');
        return;
      }

      router.replace('/(tabs)');
    } catch (err) {
      console.log('REGISTER ERROR:', err);
      showError('Registrierung fehlgeschlagen.');
    } finally {
      isSubmittingRef.current = false;
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

            <TextInput
              style={styles.input}
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

            <Text style={styles.helperText}>
              Die Recovery-Mail ist nur für Passwort-Reset und Username-Hilfe. Einloggen bleibt per
              Username.
            </Text>

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
  helperText: {
    color: COLORS.textSecondary,
    fontSize: sf(12),
    lineHeight: sf(17),
    marginTop: sv(8),
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
});
