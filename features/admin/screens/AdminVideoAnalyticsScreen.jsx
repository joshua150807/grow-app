import { useCallback, useMemo, useRef, useState } from 'react';
import {
  FlatList,
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
import AdminEmptyState from '../components/AdminEmptyState';
import AdminSummaryBox from '../components/AdminSummaryBox';
import AdminFilterChip from '../components/AdminFilterChip';

export default function AdminVideoAnalyticsScreen() {
  const [videos, setVideos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorText, setErrorText] = useState(null);
  const [sortMode, setSortMode] = useState('views');
  const activeRequestRef = useRef(0);
  const isFocusedRef = useRef(false);

  const loadVideos = useCallback(async ({ refreshing = false } = {}) => {
    const requestId = activeRequestRef.current + 1;
    activeRequestRef.current = requestId;

    try {
      if (refreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setErrorText(null);

      const list = await loadAdminVideoAnalytics(500);

      if (!isFocusedRef.current || requestId !== activeRequestRef.current) return;

      setVideos(Array.isArray(list) ? list : []);
    } catch (error) {
      console.log('Fehler beim Laden der Video Analytics:', error);

      if (!isFocusedRef.current || requestId !== activeRequestRef.current) return;

      if (String(error.message ?? '').includes('Not allowed')) {
        setErrorText('Kein Zugriff auf diese Video-Übersicht.');
      } else {
        setErrorText('Video Analytics konnten nicht geladen werden.');
      }
    } finally {
      if (isFocusedRef.current && requestId === activeRequestRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      isFocusedRef.current = true;
      loadVideos();

      return () => {
        isFocusedRef.current = false;
        activeRequestRef.current += 1;
      };
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

  const changeSortMode = useCallback((nextSortMode) => {
    setSortMode((currentSortMode) => {
      if (currentSortMode === nextSortMode) return currentSortMode;
      return nextSortMode;
    });
  }, []);

  const renderHeader = useCallback(() => (
    <>
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
        <AdminSummaryBox label="Videos" value={videos.length} />
        <AdminSummaryBox label="Views" value={summary.views} />
        <AdminSummaryBox label="Saves" value={summary.saves} />
        <AdminSummaryBox label="Ratings" value={summary.ratings} />
      </View>

      <View style={styles.sortSection}>
        <Text style={styles.sortTitle}>Sortieren nach</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.sortRow}>
            <AdminFilterChip
              label="Views"
              active={sortMode === 'views'}
              onPress={() => changeSortMode('views')}
            />
            <AdminFilterChip
              label="Saves"
              active={sortMode === 'saves'}
              onPress={() => changeSortMode('saves')}
            />
            <AdminFilterChip
              label="Ratings"
              active={sortMode === 'ratings'}
              onPress={() => changeSortMode('ratings')}
            />
            <AdminFilterChip
              label="Score"
              active={sortMode === 'score'}
              onPress={() => changeSortMode('score')}
            />
            <AdminFilterChip
              label="Meiste 👎"
              active={sortMode === 'bad'}
              onPress={() => changeSortMode('bad')}
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
    </>
  ), [changeSortMode, errorText, loadVideos, sortMode, summary.ratings, summary.saves, summary.views, videos.length]);

  const renderVideo = useCallback(({ item }) => (
    <AdminVideoAnalyticsCard video={item} />
  ), []);

  const keyExtractor = useCallback((item, index) => {
    return String(item.id ?? item.videoId ?? item.videoUrl ?? `video-${index}`);
  }, []);

  const renderEmptyState = useCallback(() => {
    if (errorText) return null;

    return (
      <AdminEmptyState
        icon="inbox"
        title="Noch keine Videos"
        text="Sobald Videos Views, Saves oder Ratings haben, erscheinen sie hier."
      />
    );
  }, [errorText]);

  if (isLoading) {
    return <AdminLoadingState text="Video Analytics werden geladen..." />;
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={errorText ? [] : sortedVideos}
        keyExtractor={keyExtractor}
        renderItem={renderVideo}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadVideos({ refreshing: true })}
            tintColor={COLORS.softGold}
          />
        }
      />
    </View>
  );
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
});
