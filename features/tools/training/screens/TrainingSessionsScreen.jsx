import { useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../../../../constants/colors';
import { s } from '../../../../constants/layout';
import { styles } from '../styles/trainingStyles';
import { useLatestTrainingSessions } from '../hooks/useLatestTrainingSessions';
import { formatTrainingSessionDate } from '../utils/trainingDateUtils';

export default function TrainingSessionsScreen() {
  const {
    sessions,
    loadingSessions,
    sessionsError,
    loadSessions,
  } = useLatestTrainingSessions();

  useFocusEffect(
    useCallback(() => {
      loadSessions();
    }, [loadSessions])
  );

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
          <View style={styles.iconCircle}>
            <Ionicons name="time-outline" size={s(36)} color={COLORS.gold} />
          </View>
          <Text style={styles.title}>LETZTE TRAININGS</Text>
          <Text style={styles.subtitle}>Deine gespeicherten Einheiten</Text>
        </View>

        {loadingSessions ? (
          <View style={styles.centered}>
            <ActivityIndicator color={COLORS.gold} size="large" />
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
              <Pressable
                key={session.id}
                style={styles.trainingSessionCard}
                onPress={() =>
                  router.push({
                    pathname: '/tools/training-session-detail',
                    params: { sessionId: session.id },
                  })
                }
              >
                <View style={styles.trainingSessionCardIcon}>
                  <Ionicons name="barbell-outline" size={s(22)} color={COLORS.gold} />
                </View>

                <View style={styles.trainingSessionCardContent}>
                  <Text style={styles.trainingSessionCardTitle}>
                    {session.dayName}
                  </Text>

                  <Text style={styles.trainingSessionCardMeta}>
                    {formatTrainingSessionDate(session.performedAt)} · {session.exerciseCount}{' '}
                    {session.exerciseCount === 1 ? 'Übung' : 'Übungen'}
                  </Text>

                  {session.note ? (
                    <Text style={styles.trainingSessionCardNote}>
                      {session.note}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}