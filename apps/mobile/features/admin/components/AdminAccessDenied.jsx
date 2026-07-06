import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { COLORS } from '../../../constants/colors';
import { s, sv, sf } from '../../../constants/layout';

export default function AdminAccessDenied({ onBack }) {
  return (
    <View style={styles.centerScreen}>
      <View style={styles.lockIcon}>
        <Feather name="lock" size={s(30)} color={COLORS.softGold} />
      </View>

      <Text style={styles.deniedTitle}>Kein Zugriff</Text>
      <Text style={styles.deniedText}>
        Dieses Dashboard ist nur für Grow CEOs und Admins sichtbar.
      </Text>

      <Pressable style={styles.backButton} onPress={onBack}>
        <Text style={styles.backButtonText}>Zurück</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  centerScreen: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: s(28),
  },
  lockIcon: {
    width: s(66),
    height: s(66),
    borderRadius: s(33),
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: sv(18),
  },
  deniedTitle: {
    color: COLORS.white,
    fontSize: sf(24),
    fontWeight: '800',
    marginBottom: sv(8),
  },
  deniedText: {
    color: COLORS.textSecondary,
    fontSize: sf(15),
    textAlign: 'center',
    lineHeight: sf(22),
  },
  backButton: {
    marginTop: sv(22),
    backgroundColor: COLORS.gold,
    paddingHorizontal: s(22),
    paddingVertical: sv(11),
    borderRadius: s(12),
  },
  backButtonText: {
    color: COLORS.black,
    fontSize: sf(15),
    fontWeight: '800',
  },
});