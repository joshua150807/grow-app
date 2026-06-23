import { useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../../../../constants/colors';
import { s } from '../../../../constants/layout';
import { styles } from '../styles/trainingStyles';
import { useLatestTrainingSessions } from '../hooks/useLatestTrainingSessions';
import { formatTrainingSessionDate } from '../utils/trainingDateUtils';
import { useDelayedLoading } from '../../../../hooks/useDelayedLoading';

export default function TrainingSessionsScreen() {
  const {
    sessions,
    loadingSessions,
    sessionsError,
    loadSessions,
    removeSession,
  } = useLatestTrainingSessions();
  const showLoading = useDelayedLoading(loadingSessions);

  useFocusEffect(
    useCallback(() => {
      loadSessions();
    }, [loadSessions])
  );

  const handleDeleteSession = useCallback((session) => {
    Alert.alert(
      'Training löschen',
      `Möchtest du „${session.dayName}" wirklich aus deinen gespeicherten Trainings löschen?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeSession(session.id);
            } catch {
              Alert.alert('Fehler', 'Training konnte nicht gelöscht werden.');
            }
          },
        },
      ]
    );
  }, [removeSession]);

  const handleOpenSession = useCallback((sessionId) => {
    router.push({
      pathname: '/tools/training-session-detail',
      params: { sessionId },
    });
  }, []);

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={s(24)} color={COLORS.softGold} />
          <Text style={styles.backText}>Zurück</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Letzte Trainings</Text>
          <Text style={styles.subtitle}>Deine gespeicherten Einheiten</Text>
        </View>

        {showLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={COLORS.softGold} size="large" />
            <Text style={styles.loadingText}>Trainings werden geladen...</Text>
          </View>
        ) : null}

        {sessionsError ? (
          <Text style={styles.saveErrorText}>{sessionsError}</Text>
        ) : null}

        {!loadingSessions && !sessionsError && sessions.length === 0 ? (
          <Text style={styles.emptyText}>
            Noch keine Trainingseinheit gespeichert.
          </Text>
        ) : null}

        {!loadingSessions && !sessionsError && sessions.length > 0 ? (
          <View>
            {sessions.map(session => (
              <View key={session.id} style={styles.trainingSessionCard}>
                <Pressable
                  style={styles.trainingSessionCardOpenArea}
                  onPress={() => handleOpenSession(session.id)}
                  hitSlop={8}
                >
                  <View style={styles.trainingSessionCardIcon}>
                    <Ionicons name={session.sessionType === 'run' ? 'walk-outline' : 'barbell-outline'} size={s(22)} color={COLORS.softGold} />
                  </View>

                  <View style={styles.trainingSessionCardContent}>
                    <Text style={styles.trainingSessionCardTitle}>
                      {session.dayName}
                    </Text>

                    <Text style={styles.trainingSessionCardMeta}>
                      {formatTrainingSessionDate(session.performedAt)} · {session.metaText}
                    </Text>

                    {session.note ? (
                      <Text style={styles.trainingSessionCardNote}>
                        {session.note}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>

                <Pressable
                  style={styles.trainingSessionDeleteButton}
                  onPress={() => handleDeleteSession(session)}
                  hitSlop={8}
                >
                  <Ionicons name="trash-outline" size={s(18)} color={COLORS.error} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}