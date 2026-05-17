import { useCallback, useMemo, useState, useEffect } from 'react';
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
import { loadAdminBetaCodes } from '../services/adminBetaCodes';
import AdminBetaCodeCard from '../components/AdminBetaCodeCard';
import AdminLoadingState from '../components/AdminLoadingState';

export default function AdminBetaCodesScreen() {
  const [codes, setCodes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorText, setErrorText] = useState(null);
  const [filterMode, setFilterMode] = useState('all');

  const loadCodes = useCallback(async ({ refreshing = false, silent = false } = {}) => {
    try {
        if(!silent) {
            if (refreshing) {
                setIsRefreshing(true);
            } else {
                setIsLoading(true);
            }
        }    

      setErrorText(null);

      const list = await loadAdminBetaCodes(1000);
      setCodes(list);
    } catch (error) {
      console.log('Fehler beim Laden der Beta Codes:', error);

      if (String(error.message ?? '').includes('Not allowed')) {
        setErrorText('Kein Zugriff auf diese Beta-Code-Übersicht.');
      } else {
        setErrorText('Beta Codes konnten nicht geladen werden.');
      }
    } finally {
        if(!silent) {
            setIsLoading(false);
            setIsRefreshing(false);
        }    
    }
  }, []);

  useEffect(() => {
    const intervalId = setInterval(() => {
        loadCodes({ silent: true });
    }, 10000);

    return () => clearInterval(intervalId);
    }, [loadCodes]);

  useFocusEffect(
    useCallback(() => {
      loadCodes();
    }, [loadCodes])
  );

  const summary = useMemo(() => {
    const used = codes.filter((item) => item.isUsed).length;
    const open = codes.length - used;

    return {
      total: codes.length,
      used,
      open,
    };
  }, [codes]);

  const visibleCodes = useMemo(() => {
    if (filterMode === 'used') {
      return codes.filter((item) => item.isUsed);
    }

    if (filterMode === 'open') {
      return codes.filter((item) => !item.isUsed);
    }

    return codes;
  }, [codes, filterMode]);

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
            onRefresh={() => loadCodes({ refreshing: true })}
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
            <Text style={styles.title}>Beta Codes</Text>
            <Text style={styles.subtitle}>
              Übersicht über eingelöste und offene Beta-Zugangscodes.
            </Text>
          </View>
        </View>

        <View style={styles.summaryGrid}>
          <SummaryBox label="Codes" value={summary.total} />
          <SummaryBox label="Benutzt" value={summary.used} />
          <SummaryBox label="Offen" value={summary.open} />
          <SummaryBox
            label="Quote"
            value={
              summary.total > 0
                ? `${Math.round((summary.used / summary.total) * 100)}%`
                : '0%'
            }
          />
        </View>

        <View style={styles.filterSection}>
          <Text style={styles.filterTitle}>Filter</Text>

          <View style={styles.filterRow}>
            <FilterChip
              label="Alle"
              active={filterMode === 'all'}
              onPress={() => setFilterMode('all')}
            />
            <FilterChip
              label="Benutzt"
              active={filterMode === 'used'}
              onPress={() => setFilterMode('used')}
            />
            <FilterChip
              label="Offen"
              active={filterMode === 'open'}
              onPress={() => setFilterMode('open')}
            />
          </View>
        </View>

        {errorText && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorText}</Text>

            <Pressable onPress={() => loadCodes()}>
              <Text style={styles.retryText}>Erneut laden</Text>
            </Pressable>
          </View>
        )}

        {!errorText && visibleCodes.length === 0 && (
          <View style={styles.emptyBox}>
            <Feather name="key" size={s(28)} color={COLORS.softGold} />
            <Text style={styles.emptyTitle}>Keine Codes gefunden</Text>
            <Text style={styles.emptyText}>
              Für diesen Filter gibt es aktuell keine Beta Codes.
            </Text>
          </View>
        )}

        {!errorText &&
          visibleCodes.map((betaCode) => (
            <AdminBetaCodeCard key={betaCode.id} betaCode={betaCode} />
          ))}
      </ScrollView>
    </View>
  );
}

function SummaryBox({ label, value }) {
  return (
    <View style={styles.summaryBox}>
      <Text style={styles.summaryValue}>{formatValue(value)}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function FilterChip({ label, active, onPress }) {
  return (
    <Pressable
      style={[styles.filterChip, active && styles.filterChipActive]}
      onPress={onPress}
    >
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function formatValue(value) {
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
  filterSection: {
    marginBottom: sv(18),
  },
  filterTitle: {
    color: COLORS.white,
    fontSize: sf(16),
    fontWeight: '850',
    marginBottom: sv(10),
  },
  filterRow: {
    flexDirection: 'row',
    gap: s(8),
  },
  filterChip: {
    borderRadius: s(999),
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    paddingHorizontal: s(13),
    paddingVertical: sv(8),
    backgroundColor: 'rgba(255,255,255,0.035)',
  },
  filterChipActive: {
    backgroundColor: COLORS.gold,
    borderColor: COLORS.gold,
  },
  filterChipText: {
    color: COLORS.textSecondary,
    fontSize: sf(13),
    fontWeight: '800',
  },
  filterChipTextActive: {
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