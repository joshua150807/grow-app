import { Pressable, StyleSheet, Text } from 'react-native';

import { COLORS } from '../../../constants/colors';
import { s, sv, sf } from '../../../constants/layout';

export default function AdminFilterChip({ label, active, onPress }) {
  return (
    <Pressable
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: s(999),
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    paddingHorizontal: s(13),
    paddingVertical: sv(8),
    backgroundColor: 'rgba(255,255,255,0.035)',
  },
  chipActive: {
    backgroundColor: COLORS.gold,
    borderColor: COLORS.gold,
  },
  chipText: {
    color: COLORS.textSecondary,
    fontSize: sf(13),
    fontWeight: '800',
  },
  chipTextActive: {
    color: COLORS.black,
  },
});