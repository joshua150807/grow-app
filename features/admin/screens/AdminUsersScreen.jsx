import { logger } from '../../../lib/logger';
import { useCallback, useMemo, useRef, useState } from 'react';
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
import { loadAdminUsersOverview } from '../services/adminUsers';

import AdminUserCard from '../components/AdminUserCard';
import AdminLoadingState from '../components/AdminLoadingState';
import AdminEmptyState from '../components/AdminEmptyState';
import AdminSummaryBox from '../components/AdminSummaryBox';
import AdminFilterChip from '../components/AdminFilterChip';

export default function AdminUsersScreen() {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorText, setErrorText] = useState(null);
  const [sortMode, setSortMode] = useState('activity');
  const activeRequestRef = useRef(0);
  const isFocusedRef = useRef(false);

  const loadUsers = useCallback(async ({ refreshing = false } = {}) => {
    const requestId = activeRequestRef.current + 1;
    activeRequestRef.current = requestId;

    try {
      if (refreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setErrorText(null);

      const list = await loadAdminUsersOverview(500);

      if (!isFocusedRef.current || requestId !== activeRequestRef.current) return;

      setUsers(Array.isArray(list) ? list : []);
    } catch (error) {
      logger.debug('Fehler beim Laden der User Analytics:', error);

      if (!isFocusedRef.current || requestId !== activeRequestRef.current) return;

      if (String(error.message ?? '').includes('Not allowed')) {
        setErrorText('Kein Zugriff auf diese User-Übersicht.');
      } else {
        setErrorText('User Analytics konnten nicht geladen werden.');
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
      loadUsers();

      return () => {
        isFocusedRef.current = false;
        activeRequestRef.current += 1;
      };
    }, [loadUsers])
  );

  const sortedUsers = useMemo(() => {
    const nextUsers = [...users];

    if (sortMode === 'activity') {
      return nextUsers.sort((a, b) => {
        const activityA =
          a.viewsCount + a.savesCount + a.ratingsCount + a.feedbacksCount;
        const activityB =
          b.viewsCount + b.savesCount + b.ratingsCount + b.feedbacksCount;

        return activityB - activityA;
      });
    }

    if (sortMode === 'points') {
      return nextUsers.sort((a, b) => b.growPoints - a.growPoints);
    }

    if (sortMode === 'views') {
      return nextUsers.sort((a, b) => b.viewsCount - a.viewsCount);
    }

    if (sortMode === 'feedbacks') {
      return nextUsers.sort((a, b) => b.feedbacksCount - a.feedbacksCount);
    }

    if (sortMode === 'newest') {
      return nextUsers.sort(
        (a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0)
      );
    }

    return nextUsers;
  }, [users, sortMode]);

  const summary = useMemo(() => {
    return users.reduce(
      (acc, user) => {
        acc.points += user.growPoints;
        acc.views += user.viewsCount;
        acc.feedbacks += user.feedbacksCount;
        acc.activeUsers +=
          user.viewsCount + user.savesCount + user.ratingsCount + user.feedbacksCount > 0
            ? 1
            : 0;

        return acc;
      },
      {
        points: 0,
        views: 0,
        feedbacks: 0,
        activeUsers: 0,
      }
    );
  }, [users]);

  if (isLoading) {
    return <AdminLoadingState text="User Analytics werden geladen..." />
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadUsers({ refreshing: true })}
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
            <Text style={styles.title}>User Analytics</Text>
            <Text style={styles.subtitle}>
              Übersicht über Beta-User, Aktivität und Engagement.
            </Text>
          </View>
        </View>

        <View style={styles.summaryGrid}>
          <AdminSummaryBox label="User" value={users.length} />
          <AdminSummaryBox label="Aktive User" value={summary.activeUsers} />
          <AdminSummaryBox label="Views" value={summary.views} />
          <AdminSummaryBox label="Feedbacks" value={summary.feedbacks} />
        </View>

        <View style={styles.sortSection}>
          <Text style={styles.sortTitle}>Sortieren nach</Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.sortRow}>
              <AdminFilterChip
                label="Aktivität"
                active={sortMode === 'activity'}
                onPress={() => setSortMode('activity')}
              />
              <AdminFilterChip
                label="Grow Points"
                active={sortMode === 'points'}
                onPress={() => setSortMode('points')}
              />
              <AdminFilterChip
                label="Views"
                active={sortMode === 'views'}
                onPress={() => setSortMode('views')}
              />
              <AdminFilterChip
                label="Feedbacks"
                active={sortMode === 'feedbacks'}
                onPress={() => setSortMode('feedbacks')}
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

            <Pressable onPress={() => loadUsers()}>
              <Text style={styles.retryText}>Erneut laden</Text>
            </Pressable>
          </View>
        )}

        {!errorText && sortedUsers.length === 0 && (
          <AdminEmptyState
            icon="inbox"
            title="Noch keine User"
            text="Sobald Nutzer vorhanden sind, erscheinen sie hier."
          />
        )}

        {!errorText &&
          sortedUsers.map((user) => (
            <AdminUserCard key={user.id} user={user} />
          ))}
      </ScrollView>
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