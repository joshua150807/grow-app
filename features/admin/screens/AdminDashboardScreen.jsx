import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';

import { COLORS } from '../../../constants/colors';
import { s, sv, sf } from '../../../constants/layout';
import { supabase } from '../../../services/supabaseClient';
import { loadAdminOverviewStats } from '../services/adminStats';

const emptyStats = {
  totalUsers: 0,
  totalFeedbacks: 0,
  totalViews: 0,
  totalSaves: 0,
  totalRatings: 0,
  usedBetaCodes: 0,
  openBetaCodes: 0,
  totalBetaCodes: 0,
};

export default function AdminDashboardScreen() {
  const [isLoading, setIsLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [stats, setStats] = useState(emptyStats);
  const [statsError, setStatsError] = useState(null);

  const checkAccessAndLoadStats = useCallback(async () => {
    try {
      setIsLoading(true);
      setStatsError(null);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setHasAccess(false);
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

      setHasAccess(allowed);

      if (!allowed) {
        return;
      }

      const overviewStats = await loadAdminOverviewStats();
      setStats(overviewStats);
    } catch (error) {
      console.log('Fehler beim Laden des CEO Dashboards:', error);
      setStatsError('Statistiken konnten nicht geladen werden.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      checkAccessAndLoadStats();
    }, [checkAccessAndLoadStats])
  );

  if (isLoading) {
    return (
      <View style={styles.centerScreen}>
        <ActivityIndicator color={COLORS.softGold} />
        <Text style={styles.loadingText}>CEO Dashboard wird geladen...</Text>
      </View>
    );
  }

  if (!hasAccess) {
    return (
      <View style={styles.centerScreen}>
        <View style={styles.lockIcon}>
          <Feather name="lock" size={s(30)} color={COLORS.softGold} />
        </View>

        <Text style={styles.deniedTitle}>Kein Zugriff</Text>
        <Text style={styles.deniedText}>
          Dieses Dashboard ist nur für Grow CEOs und Admins sichtbar.
        </Text>

        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Zurück</Text>
        </Pressable>
      </View>
    );
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
          <StatCard
            icon="people-outline"
            label="User"
            value={formatNumber(stats.totalUsers)}
          />

          <StatCard
            icon="chatbox-ellipses-outline"
            label="Feedbacks"
            value={formatNumber(stats.totalFeedbacks)}
            onPress={() => router.push('/admin-feedback')}
          />  

          <StatCard
            icon="play-circle-outline"
            label="Views"
            value={formatNumber(stats.totalViews)}
            onPress={() => router.push('/admin-video-analytics')}
          />

          <StatCard
            icon="bookmark-outline"
            label="Saves"
            value={formatNumber(stats.totalSaves)}
            onPress={() => router.push('/admin-video-analytics')}
          />

          <StatCard
            icon="flame-outline"
            label="Ratings"
            value={formatNumber(stats.totalRatings)}
            onPress={() => router.push('/admin-video-analytics')}
          />

          <StatCard
            icon="key-outline"
            label="Beta Codes"
            value={`${formatNumber(stats.usedBetaCodes)}/${formatNumber(
              stats.totalBetaCodes
            )}`}
            subLabel={`${formatNumber(stats.openBetaCodes)} offen`}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Aktueller Überblick</Text>

          <InfoRow label="Registrierte User" value={stats.totalUsers} />
          <InfoRow label="Feedbacks eingegangen" value={stats.totalFeedbacks} />
          <InfoRow label="Video Views" value={stats.totalViews} />
          <InfoRow label="Gespeicherte Videos" value={stats.totalSaves} />
          <InfoRow label="Video Bewertungen" value={stats.totalRatings} />
          <InfoRow
            label="Benutzte Beta Codes"
            value={`${stats.usedBetaCodes} von ${stats.totalBetaCodes}`}
          />
        </View>
      </ScrollView>
    </View>
  );
}

function StatCard({ icon, label, value, subLabel, onPress }) {
  const content = (
    <>
      <View style={styles.statIcon}>
        <Ionicons name={icon} size={s(22)} color={COLORS.softGold} />
      </View>

      <View>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
        {subLabel && <Text style={styles.statSubLabel}>{subLabel}</Text>}
      </View>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        style={({ pressed }) => [
          styles.statCard,
          pressed && styles.statCardPressed,
        ]}
        onPress={onPress}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={styles.statCard}>{content}</View>;
}

function InfoRow({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{formatNumber(value)}</Text>
    </View>
  );
}

function formatNumber(value) {
  if (typeof value === 'number') {
    return value.toLocaleString('de-DE');
  }

  return value;
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
  lockIcon: {
    width: s(66),
    height: s(66),
    borderRadius: s(33),
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: sv(18),
  },
  deniedTitle: {
    color: COLORS.white,
    fontSize: sf(24),
    fontWeight: '800',
    marginBottom: sv(8),
  },
  deniedText: {
    color: COLORS.textSecondary,
    fontSize: sf(15),
    textAlign: 'center',
    lineHeight: sf(22),
  },
  backButton: {
    marginTop: sv(22),
    backgroundColor: COLORS.gold,
    paddingHorizontal: s(22),
    paddingVertical: sv(11),
    borderRadius: s(12),
  },
  backButtonText: {
    color: COLORS.black,
    fontSize: sf(15),
    fontWeight: '800',
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
  statCard: {
    width: '48%',
    minHeight: sv(128),
    borderRadius: s(20),
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    padding: s(16),
    justifyContent: 'space-between',
  },
  statIcon: {
    width: s(38),
    height: s(38),
    borderRadius: s(19),
    backgroundColor: 'rgba(212,175,55,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    color: COLORS.white,
    fontSize: sf(28),
    fontWeight: '900',
    marginTop: sv(12),
  },
  statLabel: {
    color: COLORS.textSecondary,
    fontSize: sf(13),
    fontWeight: '700',
    marginTop: sv(3),
  },
  statSubLabel: {
    color: COLORS.mutedGold,
    fontSize: sf(12),
    fontWeight: '700',
    marginTop: sv(2),
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
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: sv(10),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  infoLabel: {
    color: COLORS.textSecondary,
    fontSize: sf(14),
    flex: 1,
    paddingRight: s(12),
  },
  infoValue: {
    color: COLORS.white,
    fontSize: sf(14),
    fontWeight: '800',
  },
  statCardPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.99 }],
  },
});