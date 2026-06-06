import { useCallback, useRef, useState } from 'react';
import {
  Pressable,
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
import { supabase } from '../../../services/supabaseClient';
import { loadAdminOverviewStats } from '../services/adminStats';
import AdminLoadingState from '../components/AdminLoadingState';
import AdminErrorState from '../components/AdminErrorState';
import AdminStatCard from '../components/AdminStatCard';
import AdminInfoRow from '../components/AdminInfoRow';
import AdminAccessDenied from '../components/AdminAccessDenied';

const emptyStats = {
  totalUsers: 0,
  totalFeedbacks: 0,
  totalViews: 0,
  totalSaves: 0,
  totalRatings: 0,
  totalToolOpens: 0,
  totalToolSeconds: 0,
  usedBetaCodes: 0,
  openBetaCodes: 0,
  totalBetaCodes: 0,
};

export default function AdminDashboardScreen() {
  const [isLoading, setIsLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [stats, setStats] = useState(emptyStats);
  const [statsError, setStatsError] = useState(null);
  const activeRequestRef = useRef(0);
  const isFocusedRef = useRef(false);
  const hasLoadedOnceRef = useRef(false);

  const checkAccessAndLoadStats = useCallback(async () => {
    const requestId = activeRequestRef.current + 1;
    activeRequestRef.current = requestId;

    try {
      if (!hasLoadedOnceRef.current) {
        setIsLoading(true);
      }
      setStatsError(null);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        if (isFocusedRef.current && requestId === activeRequestRef.current) {
          setHasAccess(false);
        }
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      const role = profile?.role ?? 'user';
      const allowed = role === 'ceo' || role === 'admin';

      if (!isFocusedRef.current || requestId !== activeRequestRef.current) return;

      setHasAccess(allowed);

      if (!allowed) {
        return;
      }

      const overviewStats = await loadAdminOverviewStats();

      if (!isFocusedRef.current || requestId !== activeRequestRef.current) return;

      setStats(overviewStats ?? emptyStats);
      hasLoadedOnceRef.current = true;
    } catch (error) {
      console.log('Fehler beim Laden des CEO Dashboards:', error);
      if (isFocusedRef.current && requestId === activeRequestRef.current) {
        setStatsError('Statistiken konnten nicht geladen werden.');
      }
    } finally {
      if (isFocusedRef.current && requestId === activeRequestRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      isFocusedRef.current = true;
      if (!hasLoadedOnceRef.current) {
        checkAccessAndLoadStats();
      }

      return () => {
        isFocusedRef.current = false;
        activeRequestRef.current += 1;
      };
    }, [checkAccessAndLoadStats])
  );

  if (isLoading) {
    return <AdminLoadingState text="CEO Dashboard wird geladen..." />
  }

  if (!hasAccess) {
    return <AdminAccessDenied onBack={() => router.back()} />;
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <Pressable style={styles.headerBackButton} onPress={() => router.back()}>
            <Feather name="chevron-left" size={s(24)} color={COLORS.softGold} />
          </Pressable>

          <View style={styles.headerTextBox}>
            <Text style={styles.topLabel}>GROW INTERNAL</Text>
            <Text style={styles.title}>CEO Dashboard</Text>
            <Text style={styles.subtitle}>
              Interne Übersicht für Feedback, Bewertungen und Beta-Daten.
            </Text>
          </View>
        </View>

        {statsError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{statsError}</Text>
            <Pressable onPress={checkAccessAndLoadStats}>
              <Text style={styles.retryText}>Erneut laden</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.grid}>
          <AdminStatCard
            icon="people-outline"
            label="User"
            value={formatNumber(stats.totalUsers)}
            onPress={() => router.push('/admin-users')}
          />

          <AdminStatCard
            icon="chatbox-ellipses-outline"
            label="Feedbacks"
            value={formatNumber(stats.totalFeedbacks)}
            onPress={() => router.push('/admin-feedback')}
          />  

          <AdminStatCard
            icon="play-circle-outline"
            label="Videos"
            value={formatNumber(stats.totalViews)}
            subLabel={`${formatNumber(stats.totalSaves)} Saves · ${formatNumber(
              stats.totalRatings
            )} Ratings`}
            onPress={() => router.push('/admin-video-analytics')}
          />

          <AdminStatCard
            icon="construct-outline"
            label="Tools"
            value={formatNumber(stats.totalToolOpens)}
            subLabel={`${formatDuration(stats.totalToolSeconds)} Nutzung`}
            onPress={() => router.push('/admin-tool-analytics')}
          />

          <AdminStatCard
            icon="key-outline"
            label="Beta Codes"
            value={`${formatNumber(stats.usedBetaCodes)}/${formatNumber(
              stats.totalBetaCodes
            )}`}
            subLabel={`${formatNumber(stats.openBetaCodes)} offen`}
            onPress={() => router.push('/admin-beta-codes')}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Aktueller Überblick</Text>

          <AdminInfoRow label="Registrierte User" value={stats.totalUsers} />
          <AdminInfoRow label="Feedbacks eingegangen" value={stats.totalFeedbacks} />
          <AdminInfoRow label="Video Views" value={stats.totalViews} />
          <AdminInfoRow label="Gespeicherte Videos" value={stats.totalSaves} />
          <AdminInfoRow label="Video Bewertungen" value={stats.totalRatings} />
          <AdminInfoRow label="Tool Klicks" value={stats.totalToolOpens} />
          <AdminInfoRow label="Tool Nutzungszeit" value={formatDuration(stats.totalToolSeconds)} />
          <AdminInfoRow
            label="Benutzte Beta Codes"
            value={`${stats.usedBetaCodes} von ${stats.totalBetaCodes}`}
          />
        </View>
      </ScrollView>
    </View>
  );
}

function formatNumber(value) {
  if (typeof value === 'number') {
    return value.toLocaleString('de-DE');
  }

  return value;
}

function formatDuration(totalSeconds) {
  const seconds = Number(totalSeconds ?? 0);

  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '0 Min';
  }

  const minutes = Math.round(seconds / 60);

  if (minutes < 60) {
    return `${minutes.toLocaleString('de-DE')} Min`;
  }

  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;

  if (restMinutes === 0) {
    return `${hours.toLocaleString('de-DE')} Std`;
  }

  return `${hours.toLocaleString('de-DE')} Std ${restMinutes} Min`;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: s(20),
    paddingTop: sv(56),
    paddingBottom: sv(32),
  },
  header: {
    flexDirection: 'row',
    gap: s(14),
    alignItems: 'flex-start',
    marginBottom: sv(24),
  },
  headerTextBox: {
    flex: 1,
  },
  headerBackButton: {
    width: s(42),
    height: s(42),
    borderRadius: s(21),
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    alignItems: 'center',
    justifyContent: 'center',
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
    maxWidth: s(280),
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: s(12),
  },
  section: {
    marginTop: sv(24),
    borderRadius: s(20),
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    padding: s(18),
  },
  sectionTitle: {
    color: COLORS.white,
    fontSize: sf(18),
    fontWeight: '800',
    marginBottom: sv(12),
  },
});