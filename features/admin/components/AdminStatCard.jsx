import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../../../constants/colors';
import { s, sv, sf } from '../../../constants/layout';

export default function AdminStatCard({ icon, label, value, subLabel, onPress }) {
  const content = (
    <>
      <View style={styles.statIcon}>
        <Ionicons name={icon} size={s(22)} color={COLORS.softGold} />
      </View>

      <View>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
        {subLabel && <Text style={styles.statSubLabel}>{subLabel}</Text>}
      </View>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        style={({ pressed }) => [
          styles.statCard,
          pressed && styles.statCardPressed,
        ]}
        onPress={onPress}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={styles.statCard}>{content}</View>;
}

const styles = StyleSheet.create({
  statCard: {
    flex: 1,
    minWidth: s(140),
    backgroundColor: COLORS.darkCard2,
    borderRadius: s(18),
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    padding: s(16),
    gap: sv(12),
  },
  statCardPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.99 }],
  },
  statIcon: {
    width: s(42),
    height: s(42),
    borderRadius: s(21),
    backgroundColor: 'rgba(212,175,55,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    color: COLORS.paleGold,
    fontSize: sf(22),
    fontWeight: '900',
  },
  statLabel: {
    color: COLORS.textSecondary,
    fontSize: sf(13),
    marginTop: sv(2),
  },
  statSubLabel: {
    color: COLORS.textDim,
    fontSize: sf(11),
    marginTop: sv(2),
  },
});