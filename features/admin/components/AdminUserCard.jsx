import { StyleSheet, Text, View } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';

import { COLORS } from '../../../constants/colors';
import { s, sv, sf } from '../../../constants/layout';

export default function AdminUserCard({ user }) {
  const createdAt = formatDate(user.createdAt);
  const isInternal = user.role === 'ceo' || user.role === 'admin';

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {getInitial(user.username)}
          </Text>
        </View>

        <View style={styles.userInfo}>
          <Text style={styles.username} numberOfLines={1}>
            {user.username}
          </Text>

          <View style={styles.metaRow}>
            <View style={[styles.roleBadge, isInternal && styles.roleBadgeInternal]}>
              <Text style={[styles.roleText, isInternal && styles.roleTextInternal]}>
                {user.role}
              </Text>
            </View>

            <Text style={styles.createdText}>seit {createdAt}</Text>
          </View>
        </View>
      </View>

      <View style={styles.pointsBox}>
        <Ionicons name="flash-outline" size={s(17)} color={COLORS.softGold} />
        <Text style={styles.pointsText}>
          {formatNumber(user.growPoints)} Grow Points
        </Text>
      </View>

      <View style={styles.statsGrid}>
        <MiniStat icon="play-circle" label="Views" value={user.viewsCount} />
        <MiniStat icon="bookmark" label="Saves" value={user.savesCount} />
        <MiniStat icon="bar-chart-2" label="Ratings" value={user.ratingsCount} />
        <MiniStat icon="message-square" label="Feedbacks" value={user.feedbacksCount} />
      </View>
    </View>
  );
}

function MiniStat({ icon, label, value }) {
  return (
    <View style={styles.miniStat}>
      <Feather name={icon} size={s(14)} color={COLORS.mutedGold} />
      <Text style={styles.miniValue}>{formatNumber(value)}</Text>
      <Text style={styles.miniLabel}>{label}</Text>
    </View>
  );
}

function getInitial(username) {
  if (!username) return '?';
  return username.trim().charAt(0).toUpperCase();
}

function formatNumber(value) {
  return Number(value ?? 0).toLocaleString('de-DE');
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(12),
    marginBottom: sv(14),
  },
  avatar: {
    width: s(48),
    height: s(48),
    borderRadius: s(24),
    backgroundColor: 'rgba(212,175,55,0.12)',
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: COLORS.softGold,
    fontSize: sf(19),
    fontWeight: '900',
  },
  userInfo: {
    flex: 1,
  },
  username: {
    color: COLORS.white,
    fontSize: sf(17),
    fontWeight: '900',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
    marginTop: sv(6),
    flexWrap: 'wrap',
  },
  roleBadge: {
    borderRadius: s(999),
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    paddingHorizontal: s(9),
    paddingVertical: sv(4),
  },
  roleBadgeInternal: {
    backgroundColor: 'rgba(212,175,55,0.13)',
    borderColor: COLORS.goldBorder,
  },
  roleText: {
    color: COLORS.textSecondary,
    fontSize: sf(11),
    fontWeight: '800',
  },
  roleTextInternal: {
    color: COLORS.softGold,
  },
  createdText: {
    color: COLORS.textSecondary,
    fontSize: sf(12),
    fontWeight: '650',
  },
  pointsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(7),
    borderRadius: s(14),
    backgroundColor: 'rgba(212,175,55,0.08)',
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    paddingHorizontal: s(12),
    paddingVertical: sv(9),
    marginBottom: sv(12),
  },
  pointsText: {
    color: COLORS.white,
    fontSize: sf(14),
    fontWeight: '850',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: s(7),
  },
  miniStat: {
    flex: 1,
    borderRadius: s(13),
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    paddingVertical: sv(9),
    paddingHorizontal: s(5),
    alignItems: 'center',
  },
  miniValue: {
    color: COLORS.white,
    fontSize: sf(15),
    fontWeight: '900',
    marginTop: sv(4),
  },
  miniLabel: {
    color: COLORS.textSecondary,
    fontSize: sf(9),
    fontWeight: '750',
    marginTop: sv(2),
  },
});