import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
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
import AdminEmptyState from '../components/AdminEmptyState';
import AdminSummaryBox from '../components/AdminSummaryBox';
import AdminFilterChip from '../components/AdminFilterChip';

export default function AdminBetaCodesScreen() {
  const [codes, setCodes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorText, setErrorText] = useState(null);
  const [filterMode, setFilterMode] = useState('all');
  const activeRequestRef = useRef(0);
  const isFocusedRef = useRef(false);

  const loadCodes = useCallback(async ({ refreshing = false, silent = false } = {}) => {
    const requestId = activeRequestRef.current + 1;
    activeRequestRef.current = requestId;

    try {
      if (!silent) {
        if (refreshing) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }
      }

      setErrorText(null);

      const list = await loadAdminBetaCodes(1000);

      if (!isFocusedRef.current || requestId !== activeRequestRef.current) return;

      setCodes(Array.isArray(list) ? list : []);
    } catch (error) {
      console.log('Fehler beim Laden der Beta Codes:', error);

      if (!isFocusedRef.current || requestId !== activeRequestRef.current) return;

      if (String(error.message ?? '').includes('Not allowed')) {
        setErrorText('Kein Zugriff auf diese Beta-Code-Übersicht.');
      } else {
        setErrorText('Beta Codes konnten nicht geladen werden.');
      }
    } finally {
      if (!isFocusedRef.current || requestId !== activeRequestRef.current || silent) return;

      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (isFocusedRef.current) {
        loadCodes({ silent: true });
      }
    }, 10000);

    return () => clearInterval(intervalId);
  }, [loadCodes]);

  useFocusEffect(
    useCallback(() => {
      isFocusedRef.current = true;
      loadCodes();

      return () => {
        isFocusedRef.current = false;
        activeRequestRef.current += 1;
      };
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
    return <AdminLoadingState text="Beta Codes werden geladen..." />
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
          <AdminSummaryBox label="Codes" value={summary.total} />
          <AdminSummaryBox label="Benutzt" value={summary.used} />
          <AdminSummaryBox label="Offen" value={summary.open} />
          <AdminSummaryBox
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
            <AdminFilterChip
              label="Alle"
              active={filterMode === 'all'}
              onPress={() => setFilterMode('all')}
            />
            <AdminFilterChip
              label="Benutzt"
              active={filterMode === 'used'}
              onPress={() => setFilterMode('used')}
            />
            <AdminFilterChip
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
          <AdminEmptyState 
            icon="inbox"
            title="Noch keine Beta Codes"
            text="Sobald Codes erstellt wurden, erscheinen sie hier."
          />
        )}

        {!errorText &&
          visibleCodes.map((betaCode) => (
            <AdminBetaCodeCard key={betaCode.id} betaCode={betaCode} />
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