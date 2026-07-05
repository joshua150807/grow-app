import { logger } from '../../../lib/logger';
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
import { loadAdminToolAnalyticsOverview } from '../services/adminToolAnalytics';

import AdminToolAnalyticsCard from '../components/AdminToolAnalyticsCard';
import AdminLoadingState from '../components/AdminLoadingState';
import AdminEmptyState from '../components/AdminEmptyState';
import AdminSummaryBox from '../components/AdminSummaryBox';
import AdminFilterChip from '../components/AdminFilterChip';

export default function AdminToolAnalyticsScreen() {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorText, setErrorText] = useState(null);
  const [sortMode, setSortMode] = useState('time');
  const hasLoadedOnceRef = useRef(false);
  const activeRequestRef = useRef(0);
  const isFocusedRef = useRef(false);

  const loadTools = useCallback(async ({ refreshing = false, force = false, silent = false } = {}) => {
    if (!force && !refreshing && hasLoadedOnceRef.current) {
      setIsLoading(false);
      return;
    }

    const requestId = activeRequestRef.current + 1;
    activeRequestRef.current = requestId;

    try {
      if (refreshing) {
        setIsRefreshing(true);
      } else if (!silent) {
        setIsLoading(true);
      }

      setErrorText(null);

      const list = await loadAdminToolAnalyticsOverview(500);

      if (!isFocusedRef.current || requestId !== activeRequestRef.current) return;

      setItems(Array.isArray(list) ? list : []);
      hasLoadedOnceRef.current = true;
    } catch (error) {
      logger.debug('Fehler beim Laden der Tool Analytics:', error);

      if (!isFocusedRef.current || requestId !== activeRequestRef.current) return;

      if (String(error.message ?? '').includes('Not allowed')) {
        setErrorText('Kein Zugriff auf diese Tool-Übersicht.');
      } else {
        setErrorText('Tool Analytics konnten nicht geladen werden.');
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
      loadTools({ force: true, silent: hasLoadedOnceRef.current });

      return () => {
        isFocusedRef.current = false;
        activeRequestRef.current += 1;
      };
    }, [loadTools])
  );

  const sortedItems = useMemo(() => {
    const nextItems = [...items];

    if (sortMode === 'time') {
      return nextItems.sort((a, b) => b.totalSeconds - a.totalSeconds);
    }

    if (sortMode === 'clicks') {
      return nextItems.sort((a, b) => b.opensCount - a.opensCount);
    }

    if (sortMode === 'average') {
      return nextItems.sort((a, b) => b.averageSeconds - a.averageSeconds);
    }

    if (sortMode === 'newest') {
      return nextItems.sort(
        (a, b) => new Date(b.lastOpenedAt ?? 0) - new Date(a.lastOpenedAt ?? 0)
      );
    }

    return nextItems;
  }, [items, sortMode]);

  const summary = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        acc.clicks += item.opensCount;
        acc.seconds += item.totalSeconds;
        acc.tools = items.length;
        acc.users += item.usersCount;

        return acc;
      },
      {
        clicks: 0,
        seconds: 0,
        users: 0,
        tools: 0,
      }
    );
  }, [items]);

  const handleToolPress = useCallback((item) => {
    router.push({
      pathname: '/admin-tool-analytics-detail',
      params: {
        toolId: item.toolId,
        toolTitle: item.toolTitle,
      },
    });
  }, []);

  if (isLoading) {
    return <AdminLoadingState text="Tool Analytics werden geladen..." />;
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={errorText ? [] : sortedItems}
        keyExtractor={(item) => item.toolId ?? item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadTools({ refreshing: true, force: true })}
            tintColor={COLORS.softGold}
          />
        }
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <Pressable style={styles.backButton} onPress={() => router.back()}>
                <Feather name="chevron-left" size={s(24)} color={COLORS.softGold} />
              </Pressable>

              <View style={styles.headerTextBox}>
                <Text style={styles.topLabel}>GROW INTERNAL</Text>
                <Text style={styles.title}>Tool Analytics</Text>
                <Text style={styles.subtitle}>
                  Übersicht pro Tool. Tippe auf ein Tool, um die genaue User-Auswertung zu sehen.
                </Text>
              </View>
            </View>

            <View style={styles.summaryGrid}>
              <AdminSummaryBox label="Tools" value={summary.tools} />
              <AdminSummaryBox label="Tool-User" value={summary.users} />
              <AdminSummaryBox label="Klicks" value={summary.clicks} />
              <AdminSummaryBox label="Nutzungszeit" value={formatDuration(summary.seconds)} />
            </View>

            <View style={styles.sortSection}>
              <Text style={styles.sortTitle}>Sortieren nach</Text>

              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.sortRow}>
                  <AdminFilterChip
                    label="Zeit"
                    active={sortMode === 'time'}
                    onPress={() => setSortMode('time')}
                  />
                  <AdminFilterChip
                    label="Klicks"
                    active={sortMode === 'clicks'}
                    onPress={() => setSortMode('clicks')}
                  />
                  <AdminFilterChip
                    label="Ø Zeit"
                    active={sortMode === 'average'}
                    onPress={() => setSortMode('average')}
                  />
                  <AdminFilterChip
                    label="Neueste"
                    active={sortMode === 'newest'}
                    onPress={() => setSortMode('newest')}
                  />
                </View>
              </ScrollView>
            </View>

            {errorText && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorText}</Text>

                <Pressable onPress={() => loadTools({ force: true })}>
                  <Text style={styles.retryText}>Erneut laden</Text>
                </Pressable>
              </View>
            )}
          </>
        }
        ListEmptyComponent={
          !errorText ? (
            <AdminEmptyState
              icon="tool"
              title="Noch keine Tool-Daten"
              text="Sobald User Tools öffnen, erscheinen hier Klicks und Nutzungszeit pro Tool."
            />
          ) : null
        }
        renderItem={({ item }) => (
          <AdminToolAnalyticsCard item={item} onPress={() => handleToolPress(item)} />
        )}
      />
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
    maxWidth: s(290),
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: sv(10),
    marginBottom: sv(18),
  },
  sortSection: {
    marginBottom: sv(16),
  },
  sortTitle: {
    color: COLORS.white,
    fontSize: sf(15),
    fontWeight: '850',
    marginBottom: sv(10),
  },
  sortRow: {
    flexDirection: 'row',
    gap: s(8),
    paddingRight: s(20),
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
