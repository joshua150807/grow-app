import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { COLORS } from '../../../constants/colors';
import { s, sv, sf } from '../../../constants/layout';

export default function AdminToolAnalyticsCard({ item, mode = 'tool', onPress }) {
  const isUserMode = mode === 'user';
  const isPressable = typeof onPress === 'function';

  const content = (
    <>
      <View style={styles.topRow}>
        <View style={styles.iconBox}>
          <Feather name={isUserMode ? 'user' : 'grid'} size={s(20)} color={COLORS.softGold} />
        </View>

        <View style={styles.mainInfo}>
          <Text style={styles.toolTitle} numberOfLines={1}>
            {isUserMode ? item.username : item.toolTitle}
          </Text>

          <Text style={styles.userText} numberOfLines={1}>
            {isUserMode
              ? item.email || 'Keine E-Mail'
              : `${item.usersCount ?? 0} User aktiv`}
          </Text>
        </View>

        {isPressable && (
          <Feather name="chevron-right" size={s(20)} color={COLORS.textSecondary} />
        )}
      </View>

      <View style={styles.statsRow}>
        <MiniStat label="Klicks" value={item.opensCount ?? 0} />
        <MiniStat label="Zeit" value={formatDuration(item.totalSeconds)} />
        <MiniStat label="Ø Zeit" value={formatDuration(item.averageSeconds)} />
      </View>

      <View style={styles.lastRow}>
        <Text style={styles.lastLabel}>Letzte Aktivierung</Text>
        <Text style={styles.lastValue}>{formatDateTime(item.lastOpenedAt)}</Text>
      </View>
    </>
  );

  if (isPressable) {
    return (
      <Pressable
        style={({ pressed }) => [
          styles.card,
          styles.pressableCard,
          pressed && styles.pressedCard,
        ]}
        onPress={onPress}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={styles.card}>{content}</View>;
}


function MiniStat({ label, value }) {
  return (
    <View style={styles.miniStat}>
      <Text style={styles.miniValue} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.72}>{value}</Text>
      <Text style={styles.miniLabel}>{label}</Text>
    </View>
  );
}

function formatDuration(totalSeconds) {
  const seconds = Math.round(Number(totalSeconds ?? 0));

  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '0 Sek';
  }

  if (seconds < 60) {
    return `${seconds.toLocaleString('de-DE')} Sek`;
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const restSeconds = seconds % 60;

  if (hours > 0) {
    if (minutes === 0) {
      return `${hours.toLocaleString('de-DE')} Std`;
    }

    return `${hours.toLocaleString('de-DE')} Std ${minutes} Min`;
  }

  if (restSeconds === 0) {
    return `${minutes.toLocaleString('de-DE')} Min`;
  }

  return `${minutes.toLocaleString('de-DE')} Min ${restSeconds} Sek`;
}

function formatDateTime(value) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
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
  pressableCard: {
    overflow: 'hidden',
  },
  pressedCard: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(12),
    marginBottom: sv(14),
  },
  iconBox: {
    width: s(44),
    height: s(44),
    borderRadius: s(22),
    backgroundColor: 'rgba(212,175,55,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainInfo: {
    flex: 1,
  },
  toolTitle: {
    color: COLORS.white,
    fontSize: sf(16),
    fontWeight: '900',
  },
  userText: {
    color: COLORS.textSecondary,
    fontSize: sf(12),
    fontWeight: '700',
    marginTop: sv(4),
  },
  statsRow: {
    flexDirection: 'row',
    gap: s(8),
  },
  miniStat: {
    flex: 1,
    minHeight: sv(62),
    borderRadius: s(14),
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    paddingVertical: sv(9),
    paddingHorizontal: s(6),
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniValue: {
    color: COLORS.white,
    fontSize: sf(14),
    lineHeight: sf(17),
    fontWeight: '900',
    textAlign: 'center',
  },
  miniLabel: {
    color: COLORS.textSecondary,
    fontSize: sf(11),
    fontWeight: '700',
    marginTop: sv(3),
  },
  lastRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: s(10),
    marginTop: sv(12),
    paddingTop: sv(12),
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  lastLabel: {
    color: COLORS.textSecondary,
    fontSize: sf(12),
    fontWeight: '700',
  },
  lastValue: {
    color: COLORS.white,
    fontSize: sf(12),
    fontWeight: '800',
  },
});
