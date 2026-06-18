import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { COLORS } from '../../../constants/colors';
import { s, sv, sf } from '../../../constants/layout';
import useAdminAccess from '../hooks/useAdminAccess';
import AdminAccessDenied from './AdminAccessDenied';
import AdminLoadingState from './AdminLoadingState';

function goBackSafely() {
  if (router.canGoBack?.()) {
    router.back();
    return;
  }

  router.replace('/(tabs)/tools');
}

export default function AdminProtectedRoute({ children }) {
  const {
    isCheckingAccess,
    hasAdminAccess,
    accessError,
    refreshAdminAccess,
  } = useAdminAccess();

  if (isCheckingAccess) {
    return <AdminLoadingState text="Admin-Zugriff wird geprüft..." />;
  }

  if (accessError) {
    return (
      <View style={styles.centerScreen}>
        <Text style={styles.errorTitle}>Zugriff konnte nicht geprüft werden</Text>
        <Text style={styles.errorText}>{accessError}</Text>

        <Pressable style={styles.primaryButton} onPress={refreshAdminAccess}>
          <Text style={styles.primaryButtonText}>Erneut prüfen</Text>
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={goBackSafely}>
          <Text style={styles.secondaryButtonText}>Zurück</Text>
        </Pressable>
      </View>
    );
  }

  if (!hasAdminAccess) {
    return <AdminAccessDenied onBack={goBackSafely} />;
  }

  return children;
}

const styles = StyleSheet.create({
  centerScreen: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: s(28),
  },
  errorTitle: {
    color: COLORS.white,
    fontSize: sf(21),
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: sv(8),
  },
  errorText: {
    color: COLORS.textSecondary,
    fontSize: sf(15),
    textAlign: 'center',
    lineHeight: sf(22),
  },
  primaryButton: {
    marginTop: sv(22),
    backgroundColor: COLORS.gold,
    paddingHorizontal: s(22),
    paddingVertical: sv(11),
    borderRadius: s(12),
  },
  primaryButtonText: {
    color: COLORS.black,
    fontSize: sf(15),
    fontWeight: '800',
  },
  secondaryButton: {
    marginTop: sv(12),
    paddingHorizontal: s(18),
    paddingVertical: sv(9),
  },
  secondaryButtonText: {
    color: COLORS.textSecondary,
    fontSize: sf(14),
    fontWeight: '700',
  },
});
