import { useMemo, useState } from 'react';
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
import * as Linking from 'expo-linking';

import { supabase } from '../../services/supabaseClient';
import { COLORS } from '../../constants/colors';
import { s, sv, sf } from '../../constants/layout';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordScreen() {
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [foundUsername, setFoundUsername] = useState('');
  const [errorText, setErrorText] = useState('');
  const [successText, setSuccessText] = useState('');
  const [loading, setLoading] = useState(false);
  const cleanRecoveryEmail = useMemo(
    () => recoveryEmail.trim().toLowerCase(),
    [recoveryEmail]
  );

  async function handleRecovery() {
    Keyboard.dismiss();
    setErrorText('');
    setSuccessText('');
    setFoundUsername('');

    if (!EMAIL_REGEX.test(cleanRecoveryEmail)) {
      setErrorText('Bitte eine gültige Recovery-Mail eingeben.');
      return;
    }

    try {
      setLoading(true);

      const { data: username, error: usernameError } = await supabase.rpc(
        'get_username_for_recovery_email',
        {
          input_recovery_email: cleanRecoveryEmail,
        }
      );

      if (usernameError) {
        console.log('USERNAME RECOVERY ERROR:', usernameError);
      }

      if (username) {
        setFoundUsername(username);
      }

      const redirectTo = Linking.createURL('/reset-password');

      const { error } = await supabase.auth.resetPasswordForEmail(cleanRecoveryEmail, {
        redirectTo,
      });

      if (error) {
        const message = error.message?.toLowerCase() || '';

        if (message.includes('rate limit')) {
          setErrorText('Zu viele Versuche. Bitte warte kurz und versuche es später erneut.');
        } else {
          setErrorText('Recovery-Mail konnte nicht gesendet werden. Bitte prüfe die E-Mail.');
        }

        return;
      }

      setSuccessText(
        'Wenn diese Recovery-Mail zu einem Grow-Account gehört, wurde ein Reset-Link gesendet.'
      );
    } catch (err) {
      console.log('PASSWORD RESET ERROR:', err);
      setErrorText('Recovery fehlgeschlagen. Bitte erneut versuchen.');
    } finally {
      setLoading(false);
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
            <Pressable
              style={styles.backButton}
              onPress={() => {
                Keyboard.dismiss();
                router.back();
              }}
              hitSlop={12}
            >
              <Ionicons name="chevron-back" size={22} color={COLORS.gold} />
              <Text style={styles.backText}>Zurück</Text>
            </Pressable>

            <Text style={styles.logo}>Grow</Text>
            <Text style={styles.subtitle}>Account wiederherstellen</Text>

            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>Recovery-Mail</Text>
              <Text style={styles.infoText}>
                Gib die Recovery-Mail ein, die du bei der Registrierung hinterlegt hast. Dein Login
                bleibt trotzdem dein Username.
              </Text>
            </View>

            <Text style={styles.label}>Recovery-Mail</Text>
            <TextInput
              value={recoveryEmail}
              onChangeText={setRecoveryEmail}
              placeholder="deine@mail.de"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleRecovery}
              style={styles.input}
            />

            {!!foundUsername && (
              <View style={styles.usernameBox}>
                <Text style={styles.usernameLabel}>Dein Username</Text>
                <Text style={styles.usernameText}>{foundUsername}</Text>
              </View>
            )}

            {!!errorText && <Text style={styles.error}>{errorText}</Text>}
            {!!successText && <Text style={styles.success}>{successText}</Text>}

            <Pressable
              style={({ pressed }) => [
                styles.button,
                pressed && !loading && styles.buttonPressed,
                loading && styles.buttonDisabled,
              ]}
              onPress={handleRecovery}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.black} />
              ) : (
                <Text style={styles.buttonText}>Reset-Link senden</Text>
              )}
            </Pressable>

            <Text style={styles.footerText}>
              Der Link öffnet Grow und führt dich zur Seite, auf der du ein neues Passwort setzen
              kannst.
            </Text>
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
  backButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: sv(10),
  },
  backText: {
    color: COLORS.gold,
    fontSize: sf(13),
    fontWeight: '800',
    marginLeft: s(2),
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
    marginBottom: sv(22),
  },
  infoBox: {
    backgroundColor: COLORS.black,
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    borderRadius: s(16),
    padding: s(14),
    marginBottom: sv(16),
  },
  infoTitle: {
    color: COLORS.softGold,
    fontSize: sf(14),
    fontWeight: '800',
    marginBottom: sv(6),
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
  usernameBox: {
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    backgroundColor: COLORS.black,
    borderRadius: s(16),
    padding: s(14),
    marginTop: sv(14),
  },
  usernameLabel: {
    color: COLORS.softGold,
    fontSize: sf(12),
    fontWeight: '800',
    marginBottom: sv(4),
  },
  usernameText: {
    color: COLORS.gold,
    fontSize: sf(17),
    fontWeight: '900',
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
  footerText: {
    color: COLORS.textSecondary,
    fontSize: sf(12),
    lineHeight: sf(17),
    textAlign: 'center',
    marginTop: sv(16),
  },
});
