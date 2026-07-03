import { StyleSheet, Text, View } from 'react-native';

import { COLORS } from '../../../constants/colors';
import { s, sv, sf } from '../../../constants/layout';

export default function AdminInfoRow({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{formatNumber(value)}</Text>
    </View>
  );
}

function formatNumber(value) {
  if (typeof value === 'number') {
    return value.toLocaleString('de-DE');
  }

  return value;
}

const styles = StyleSheet.create({
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: s(12),
    paddingVertical: sv(9),
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
  },
  infoLabel: {
    color: COLORS.textSecondary,
    fontSize: sf(13),
  },
  infoValue: {
    color: COLORS.paleGold,
    fontSize: sf(13),
    fontWeight: '800',
  },
});