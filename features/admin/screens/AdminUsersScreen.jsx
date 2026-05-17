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
import { loadAdminUsersOverview } from '../services/adminUsers';
import AdminUserCard from '../components/AdminUserCard';
import AdminLoadingState from '../components/AdminLoadingState';

export default function AdminUsersScreen() {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorText, setErrorText] = useState(null);
  const [sortMode, setSortMode] = useState('activity');

  const loadUsers = useCallback(async ({ refreshing = false } = {}) => {
    try {
      if (refreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setErrorText(null);

      const list = await loadAdminUsersOverview(500);
      setUsers(list);
    } catch (error) {
      console.log('Fehler beim Laden der User Analytics:', error);

      if (String(error.message ?? '').includes('Not allowed')) {
        setErrorText('Kein Zugriff auf diese User-Übersicht.');
      } else {
        setErrorText('User Analytics konnten nicht geladen werden.');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadUsers();
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
          <SummaryBox label="User" value={users.length} />
          <SummaryBox label="Aktive User" value={summary.activeUsers} />
          <SummaryBox label="Views" value={summary.views} />
          <SummaryBox label="Feedbacks" value={summary.feedbacks} />
        </View>

        <View style={styles.sortSection}>
          <Text style={styles.sortTitle}>Sortieren nach</Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.sortRow}>
              <SortChip
                label="Aktivität"
                active={sortMode === 'activity'}
                onPress={() => setSortMode('activity')}
              />
              <SortChip
                label="Grow Points"
                active={sortMode === 'points'}
                onPress={() => setSortMode('points')}
              />
              <SortChip
                label="Views"
                active={sortMode === 'views'}
                onPress={() => setSortMode('views')}
              />
              <SortChip
                label="Feedbacks"
                active={sortMode === 'feedbacks'}
                onPress={() => setSortMode('feedbacks')}
              />
              <SortChip
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
          <View style={styles.emptyBox}>
            <Feather name="users" size={s(28)} color={COLORS.softGold} />
            <Text style={styles.emptyTitle}>Noch keine User</Text>
            <Text style={styles.emptyText}>
              Sobald sich Nutzer registrieren, erscheinen sie hier.
            </Text>
          </View>
        )}

        {!errorText &&
          sortedUsers.map((user) => (
            <AdminUserCard key={user.id} user={user} />
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