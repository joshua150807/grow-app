import { StyleSheet, Text, View } from 'react-native';

import { COLORS } from '../../../constants/colors';
import { s, sv, sf } from '../../../constants/layout';

export default function AdminSummaryBox({ label, value }) {
  return (
    <View style={styles.summaryBox}>
      <Text style={styles.summaryValue} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.75}>{formatNumber(value)}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function formatNumber(value) {
  if (typeof value === 'string') {
    return value;
  }

  return Number(value ?? 0).toLocaleString('de-DE');
}

const styles = StyleSheet.create({
  summaryBox: {
    width: '48%',
    borderRadius: s(18),
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    padding: s(15),
  },
  summaryValue: {
    color: COLORS.white,
    fontSize: sf(23),
    fontWeight: '900',
    lineHeight: sf(27),
  },
  summaryLabel: {
    color: COLORS.textSecondary,
    fontSize: sf(12),
    fontWeight: '800',
    marginTop: sv(3),
  },
});