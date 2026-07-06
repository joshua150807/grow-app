import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { COLORS } from '../../../constants/colors';
import { s, sv, sf } from '../../../constants/layout';

export default function AdminBetaCodeCard({ betaCode }) {
  const usedAt = formatDate(betaCode.usedAt);

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.codeBox}>
          <Text style={styles.codeText}>{betaCode.code}</Text>
        </View>

        <View
          style={[
            styles.statusBadge,
            betaCode.isUsed ? styles.statusUsed : styles.statusOpen,
          ]}
        >
          <Text
            style={[
              styles.statusText,
              betaCode.isUsed ? styles.statusTextUsed : styles.statusTextOpen,
            ]}
          >
            {betaCode.isUsed ? 'Benutzt' : 'Offen'}
          </Text>
        </View>
      </View>

      <View style={styles.metaBox}>
        <View style={styles.metaRow}>
          <Feather name="user" size={s(14)} color={COLORS.mutedGold} />
          <Text style={styles.metaText}>
            {betaCode.username
              ? `Benutzt von ${betaCode.username}`
              : 'Noch keinem User zugeordnet'}
          </Text>
        </View>

        <View style={styles.metaRow}>
          <Feather name="clock" size={s(14)} color={COLORS.mutedGold} />
          <Text style={styles.metaText}>
            {betaCode.isUsed ? `Benutzt am ${usedAt}` : 'Noch nicht benutzt'}
          </Text>
        </View>
      </View>
    </View>
  );
}

function formatDate(value) {
  if (!value) return 'unbekannt';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'unbekannt';
  }

  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

const styles = StyleSheet.create({
  card: {
    borderRadius: s(20),
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    padding: s(16),
    marginBottom: sv(14),
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(10),
    justifyContent: 'space-between',
    marginBottom: sv(13),
  },
  codeBox: {
    flex: 1,
    borderRadius: s(14),
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: s(12),
    paddingVertical: sv(10),
  },
  codeText: {
    color: COLORS.white,
    fontSize: sf(15),
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  statusBadge: {
    borderRadius: s(999),
    borderWidth: 1,
    paddingHorizontal: s(10),
    paddingVertical: sv(6),
  },
  statusUsed: {
    backgroundColor: 'rgba(212,175,55,0.12)',
    borderColor: COLORS.goldBorder,
  },
  statusOpen: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.12)',
  },
  statusText: {
    fontSize: sf(11),
    fontWeight: '900',
  },
  statusTextUsed: {
    color: COLORS.softGold,
  },
  statusTextOpen: {
    color: COLORS.textSecondary,
  },
  metaBox: {
    gap: sv(8),
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
  },
  metaText: {
    color: COLORS.textSecondary,
    fontSize: sf(13),
    fontWeight: '650',
  },
});