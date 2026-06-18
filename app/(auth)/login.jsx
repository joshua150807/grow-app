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

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [loading, setLoading] = useState(false);
  const isMountedRef = useRef(true);
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  async function getLoginEmail(cleanUsername) {
    const { data, error } = await supabase.rpc('get_auth_email_for_username', {
      input_username: cleanUsername,
    });

    if (error) {
      throw error;
    }

    return data;
  }

  async function handleLogin() {
    if (isSubmittingRef.current) return;

    Keyboard.dismiss();
    setErrorText('');

    const cleanUsername = username.trim().toLowerCase();

    if (!cleanUsername || !password) {
      setErrorText('Bitte Username und Passwort eingeben.');
      return;
    }

    try {
      isSubmittingRef.current = true;
      setLoading(true);

      const resolvedEmail = await getLoginEmail(cleanUsername);
      const email = resolvedEmail || `${cleanUsername}@growapp.com`;

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (isMountedRef.current) {
          setErrorText('Username oder Passwort ist falsch.');
        }
        return;
      }

      router.replace('/(tabs)');
    } catch (err) {
      logger.debug('LOGIN ERROR:', err);
      if (isMountedRef.current) {
        setErrorText('Login fehlgeschlagen. Bitte erneut versuchen.');
      }
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
            <Text style={styles.subtitle}>Willkommen zurück</Text>

            <Text style={styles.label}>Username</Text>
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="z. B. user1"
              placeholderTextColor={COLORS.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              style={styles.input}
            />

            <Text style={styles.label}>Passwort</Text>
            <View style={styles.passwordWrap}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Passwort"
                placeholderTextColor={COLORS.textMuted}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
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

            {!!errorText && <Text style={styles.error}>{errorText}</Text>}

            <Pressable
              style={({ pressed }) => [
                styles.button,
                pressed && !loading && styles.buttonPressed,
              ]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.black} />
              ) : (
                <Text style={styles.buttonText}>Einloggen</Text>
              )}
            </Pressable>

            <Pressable
              style={styles.forgotLink}
              onPress={() => {
                Keyboard.dismiss();
                router.push('/forgot-password');
              }}
            >
              <Text style={styles.forgotText}>Passwort oder Username vergessen?</Text>
            </Pressable>

            <Pressable
              style={styles.registerLink}
              onPress={() => {
                Keyboard.dismiss();
                router.push('/(auth)/register');
              }}
            >
              <Text style={styles.registerText}>
                Noch keinen Account? <Text style={styles.registerGold}>Registrieren</Text>
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
    marginBottom: sv(6),
  },
  subtitle: {
    color: COLORS.textPrimary,
    fontSize: sf(15),
    textAlign: 'center',
    marginBottom: sv(28),
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
  buttonText: {
    color: COLORS.black,
    fontSize: sf(16),
    fontWeight: '800',
  },
  forgotLink: {
    marginTop: sv(16),
    alignItems: 'center',
  },
  forgotText: {
    color: COLORS.lightGold,
    fontSize: sf(13),
    fontWeight: '800',
  },
  registerLink: {
    marginTop: sv(14),
    alignItems: 'center',
  },
  registerText: {
    color: COLORS.textSecondary,
    fontSize: sf(13),
    textAlign: 'center',
  },
  registerGold: {
    color: COLORS.gold,
    fontWeight: '900',
  },
});
