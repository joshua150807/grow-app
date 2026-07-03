import { Image, StyleSheet, Text, View } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';

import { COLORS } from '../../../constants/colors';
import { s, sv, sf } from '../../../constants/layout';

export default function AdminVideoAnalyticsCard({ video }) {
  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.thumbnailBox}>
          {video.thumbnailUrl ? (
            <Image
              source={{ uri: video.thumbnailUrl }}
              style={styles.thumbnail}
              resizeMode="cover"
            />
          ) : (
            <Ionicons name="videocam-outline" size={s(28)} color={COLORS.softGold} />
          )}
        </View>

        <View style={styles.videoInfo}>
          <Text style={styles.title} numberOfLines={2}>
            {video.title}
          </Text>

          <Text style={styles.scoreText}>
            Score: {video.score > 0 ? video.score.toFixed(1) : '—'} / 5
          </Text>
        </View>
      </View>

      <View style={styles.statsGrid}>
        <MiniStat icon="play-circle" label="Views" value={video.viewsCount} />
        <MiniStat icon="bookmark" label="Saves" value={video.savesCount} />
        <MiniStat icon="bar-chart-2" label="Ratings" value={video.ratingsCount} />
      </View>

      <View style={styles.ratingRow}>
        <RatingPill emoji="👎" value={video.negativeCount} label="nicht gut" />
        <RatingPill emoji="😐" value={video.neutralCount} label="neutral" />
        <RatingPill emoji="👍" value={video.goodCount} label="gut" />
        <RatingPill emoji="🔥" value={video.fireCount} label="stark" />
      </View>
    </View>
  );
}

function MiniStat({ icon, label, value }) {
  return (
    <View style={styles.miniStat}>
      <Feather name={icon} size={s(15)} color={COLORS.mutedGold} />
      <Text style={styles.miniValue}>{formatNumber(value)}</Text>
      <Text style={styles.miniLabel}>{label}</Text>
    </View>
  );
}

function RatingPill({ emoji, value, label }) {
  return (
    <View style={styles.ratingPill}>
      <Text style={styles.ratingEmoji}>{emoji}</Text>
      <View>
        <Text style={styles.ratingValue}>{formatNumber(value)}</Text>
        <Text style={styles.ratingLabel}>{label}</Text>
      </View>
    </View>
  );
}

function formatNumber(value) {
  return Number(value ?? 0).toLocaleString('de-DE');
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
    gap: s(13),
    alignItems: 'center',
    marginBottom: sv(15),
  },
  thumbnailBox: {
    width: s(72),
    height: sv(96),
    borderRadius: s(14),
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  videoInfo: {
    flex: 1,
  },
  title: {
    color: COLORS.white,
    fontSize: sf(16),
    fontWeight: '850',
    lineHeight: sf(21),
  },
  scoreText: {
    color: COLORS.softGold,
    fontSize: sf(13),
    fontWeight: '800',
    marginTop: sv(8),
  },
  statsGrid: {
    flexDirection: 'row',
    gap: s(8),
    marginBottom: sv(12),
  },
  miniStat: {
    flex: 1,
    borderRadius: s(14),
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    paddingVertical: sv(10),
    paddingHorizontal: s(8),
    alignItems: 'center',
  },
  miniValue: {
    color: COLORS.white,
    fontSize: sf(16),
    fontWeight: '900',
    marginTop: sv(4),
  },
  miniLabel: {
    color: COLORS.textSecondary,
    fontSize: sf(11),
    fontWeight: '700',
    marginTop: sv(2),
  },
  ratingRow: {
    flexDirection: 'row',
    gap: s(8),
  },
  ratingPill: {
    flex: 1,
    borderRadius: s(13),
    backgroundColor: 'rgba(212,175,55,0.08)',
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    paddingVertical: sv(8),
    paddingHorizontal: s(5),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(3),
  },
  ratingEmoji: {
    fontSize: sf(18),
  },
  ratingValue: {
    color: COLORS.white,
    fontSize: sf(14),
    fontWeight: '900',
  },
  ratingLabel: {
    color: COLORS.textSecondary,
    fontSize: sf(9),
    fontWeight: '700',
  },
});