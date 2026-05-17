import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { COLORS } from '../../../constants/colors';
import { s, sv, sf } from '../../../constants/layout';
import { loadAdminVideoAnalytics } from '../services/adminVideoAnalytics';
import AdminVideoAnalyticsCard from '../components/AdminVideoAnalyticsCard';
import AdminLoadingState from '../components/AdminLoadingState';

export default function AdminVideoAnalyticsScreen() {
  const [videos, setVideos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorText, setErrorText] = useState(null);
  const [sortMode, setSortMode] = useState('views');

  const loadVideos = useCallback(async ({ refreshing = false } = {}) => {
    try {
      if (refreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setErrorText(null);

      const list = await loadAdminVideoAnalytics(500);
      setVideos(list);
    } catch (error) {
      console.log('Fehler beim Laden der Video Analytics:', error);

      if (String(error.message ?? '').includes('Not allowed')) {
        setErrorText('Kein Zugriff auf diese Video-Übersicht.');
      } else {
        setErrorText('Video Analytics konnten nicht geladen werden.');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadVideos();
    }, [loadVideos])
  );

  const sortedVideos = useMemo(() => {
    const nextVideos = [...videos];

    if (sortMode === 'views') {
      return nextVideos.sort((a, b) => b.viewsCount - a.viewsCount);
    }

    if (sortMode === 'saves') {
      return nextVideos.sort((a, b) => b.savesCount - a.savesCount);
    }

    if (sortMode === 'ratings') {
      return nextVideos.sort((a, b) => b.ratingsCount - a.ratingsCount);
    }

    if (sortMode === 'score') {
      return nextVideos.sort((a, b) => b.score - a.score);
    }

    if (sortMode === 'bad') {
      return nextVideos.sort((a, b) => b.thumbsDownCount - a.thumbsDownCount);
    }

    return nextVideos;
  }, [videos, sortMode]);

  const summary = useMemo(() => {
    return videos.reduce(
      (acc, video) => {
        acc.views += video.viewsCount;
        acc.saves += video.savesCount;
        acc.ratings += video.ratingsCount;
        return acc;
      },
      {
        views: 0,
        saves: 0,
        ratings: 0,
      }
    );
  }, [videos]);

  if (isLoading) {
    return <AdminLoadingState text="CEO Dashboard wird geladen..." />
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadVideos({ refreshing: true })}
            tintColor={COLORS.softGold}
          />
        }
      >
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Feather name="chevron-left" size={s(24)} color={COLORS.softGold} />
          </Pressable>

          <View style={styles.headerTextBox}>
            <Text style={styles.topLabel}>GROW INTERNAL</Text>
            <Text style={styles.title}>Video Analytics</Text>
            <Text style={styles.subtitle}>
              Auswertung von Views, Saves und Bewertungen pro Video.
            </Text>
          </View>
        </View>

        <View style={styles.summaryGrid}>
          <SummaryBox label="Videos" value={videos.length} />
          <SummaryBox label="Views" value={summary.views} />
          <SummaryBox label="Saves" value={summary.saves} />
          <SummaryBox label="Ratings" value={summary.ratings} />
        </View>

        <View style={styles.sortSection}>
          <Text style={styles.sortTitle}>Sortieren nach</Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.sortRow}>
              <SortChip
                label="Views"
                active={sortMode === 'views'}
                onPress={() => setSortMode('views')}
              />
              <SortChip
                label="Saves"
                active={sortMode === 'saves'}
                onPress={() => setSortMode('saves')}
              />
              <SortChip
                label="Ratings"
                active={sortMode === 'ratings'}
                onPress={() => setSortMode('ratings')}
              />
              <SortChip
                label="Score"
                active={sortMode === 'score'}
                onPress={() => setSortMode('score')}
              />
              <SortChip
                label="Meiste 👎"
                active={sortMode === 'bad'}
                onPress={() => setSortMode('bad')}
              />
            </View>
          </ScrollView>
        </View>

        {errorText && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorText}</Text>

            <Pressable onPress={() => loadVideos()}>
              <Text style={styles.retryText}>Erneut laden</Text>
            </Pressable>
          </View>
        )}

        {!errorText && sortedVideos.length === 0 && (
          <View style={styles.emptyBox}>
            <Feather name="video" size={s(28)} color={COLORS.softGold} />
            <Text style={styles.emptyTitle}>Noch keine Video-Daten</Text>
            <Text style={styles.emptyText}>
              Sobald Videos Views, Saves oder Ratings haben, erscheinen sie hier.
            </Text>
          </View>
        )}

        {!errorText &&
          sortedVideos.map((video) => (
            <AdminVideoAnalyticsCard key={video.id} video={video} />
          ))}
      </ScrollView>
    </View>
  );
}

function SummaryBox({ label, value }) {
  return (
    <View style={styles.summaryBox}>
      <Text style={styles.summaryValue}>{formatNumber(value)}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function SortChip({ label, active, onPress }) {
  return (
    <Pressable
      style={[styles.sortChip, active && styles.sortChipActive]}
      onPress={onPress}
    >
      <Text style={[styles.sortChipText, active && styles.sortChipTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function formatNumber(value) {
  return Number(value ?? 0).toLocaleString('de-DE');
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: s(20),
    paddingTop: sv(56),
    paddingBottom: sv(34),
  },
  centerScreen: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: s(28),
  },
  loadingText: {
    marginTop: sv(14),
    color: COLORS.textSecondary,
    fontSize: sf(14),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: s(14),
    marginBottom: sv(22),
  },
  backButton: {
    width: s(42),
    height: s(42),
    borderRadius: s(21),
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextBox: {
    flex: 1,
  },
  topLabel: {
    color: COLORS.softGold,
    fontSize: sf(11),
    fontWeight: '800',
    letterSpacing: 1.3,
    marginBottom: sv(4),
  },
  title: {
    color: COLORS.white,
    fontSize: sf(28),
    fontWeight: '900',
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: sf(14),
    lineHeight: sf(20),
    marginTop: sv(6),
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: s(10),
    marginBottom: sv(22),
  },
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
    fontSize: sf(25),
    fontWeight: '900',
  },
  summaryLabel: {
    color: COLORS.textSecondary,
    fontSize: sf(12),
    fontWeight: '800',
    marginTop: sv(3),
  },
  sortSection: {
    marginBottom: sv(18),
  },
  sortTitle: {
    color: COLORS.white,
    fontSize: sf(16),
    fontWeight: '850',
    marginBottom: sv(10),
  },
  sortRow: {
    flexDirection: 'row',
    gap: s(8),
    paddingRight: s(18),
  },
  sortChip: {
    borderRadius: s(999),
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    paddingHorizontal: s(13),
    paddingVertical: sv(8),
    backgroundColor: 'rgba(255,255,255,0.035)',
  },
  sortChipActive: {
    backgroundColor: COLORS.gold,
    borderColor: COLORS.gold,
  },
  sortChipText: {
    color: COLORS.textSecondary,
    fontSize: sf(13),
    fontWeight: '800',
  },
  sortChipTextActive: {
    color: COLORS.black,
  },
  errorBox: {
    borderRadius: s(16),
    backgroundColor: 'rgba(255,80,80,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,80,80,0.25)',
    padding: s(14),
    marginBottom: sv(18),
  },
  errorText: {
    color: COLORS.white,
    fontSize: sf(14),
    marginBottom: sv(8),
  },
  retryText: {
    color: COLORS.softGold,
    fontSize: sf(14),
    fontWeight: '800',
  },
  emptyBox: {
    alignItems: 'center',
    borderRadius: s(20),
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    padding: s(24),
  },
  emptyTitle: {
    color: COLORS.white,
    fontSize: sf(18),
    fontWeight: '800',
    marginTop: sv(12),
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: sf(14),
    textAlign: 'center',
    lineHeight: sf(21),
    marginTop: sv(6),
  },
});