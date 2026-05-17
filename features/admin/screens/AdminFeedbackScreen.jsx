import { useCallback, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { COLORS } from '../../../constants/colors';
import { s, sv, sf } from '../../../constants/layout';
import { loadAdminFeedbackList, deleteAdminFeedback } from '../services/adminFeedback';
import AdminFeedbackCard from '../components/AdminFeedbackCard';
import AdminLoadingState from '../components/AdminLoadingState';

export default function AdminFeedbackScreen() {
  const [feedbacks, setFeedbacks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorText, setErrorText] = useState(null);

  const loadFeedbacks = useCallback(async ({ refreshing = false } = {}) => {
    try {
      if (refreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setErrorText(null);

      const list = await loadAdminFeedbackList(100);
      setFeedbacks(list);
    } catch (error) {
      console.log('Fehler beim Laden der Admin-Feedbacks:', error);

      if (String(error.message ?? '').includes('Not allowed')) {
        setErrorText('Kein Zugriff auf diese Feedback-Übersicht.');
      } else {
        setErrorText('Feedbacks konnten nicht geladen werden.');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const handleDeleteFeedback = useCallback((feedback) => {
    Alert.alert(
      'Feedback löschen?',
      'Dieses Feedback wird dauerhaft gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.',
      [
        {
          text: 'Abbrechen',
          style: 'cancel',
        },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAdminFeedback(feedback.id);

              setFeedbacks((prevFeedbacks) =>
                prevFeedbacks.filter((item) => item.id !== feedback.id)
              );
            } catch (error) {
              console.log('Fehler beim Löschen des Feedbacks:', error);

              Alert.alert(
                'Fehler',
                'Feedback konnte nicht gelöscht werden.'
              );
            }
          },
        },
      ]
    );
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadFeedbacks();
    }, [loadFeedbacks])
  );

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
            onRefresh={() => loadFeedbacks({ refreshing: true })}
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
            <Text style={styles.title}>Feedbacks</Text>
            <Text style={styles.subtitle}>
              Alle eingegangenen Beta-Feedbacks der Nutzer.
            </Text>
          </View>
        </View>

        <View style={styles.summaryBox}>
          <Text style={styles.summaryValue}>{feedbacks.length}</Text>
          <Text style={styles.summaryLabel}>geladene Feedbacks</Text>
        </View>

        {errorText && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorText}</Text>

            <Pressable onPress={() => loadFeedbacks()}>
              <Text style={styles.retryText}>Erneut laden</Text>
            </Pressable>
          </View>
        )}

        {!errorText && feedbacks.length === 0 && (
          <View style={styles.emptyBox}>
            <Feather name="inbox" size={s(28)} color={COLORS.softGold} />
            <Text style={styles.emptyTitle}>Noch keine Feedbacks</Text>
            <Text style={styles.emptyText}>
              Sobald Nutzer Feedback senden, erscheint es hier.
            </Text>
          </View>
        )}

        {!errorText &&
          feedbacks.map((feedback) => (
            <AdminFeedbackCard key={feedback.id} feedback={feedback} onDelete={handleDeleteFeedback} />
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
  summaryBox: {
    borderRadius: s(20),
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    padding: s(18),
    marginBottom: sv(18),
  },
  summaryValue: {
    color: COLORS.white,
    fontSize: sf(34),
    fontWeight: '900',
  },
  summaryLabel: {
    color: COLORS.textSecondary,
    fontSize: sf(14),
    fontWeight: '700',
    marginTop: sv(2),
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