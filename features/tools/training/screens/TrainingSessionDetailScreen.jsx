import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../../../../constants/colors';
import { s } from '../../../../constants/layout';
import { styles } from '../styles/trainingStyles';
import { fetchTrainingSessionDetail } from '../services/trainingSessionService';
import { formatTrainingSessionDate } from '../utils/trainingDateUtils';

export default function TrainingSessionDetailScreen() {
  const { sessionId } = useLocalSearchParams();

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadSession = useCallback(async () => {
    if (!sessionId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await fetchTrainingSessionDetail(sessionId);
      setSession(data);
    } catch (e) {
      console.error('[Training Session Detail] Load failed:', e);
      setError('Trainingseinheit konnte nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={COLORS.gold} size="large" />
        <Text style={styles.loadingText}>Training wird geladen...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable onPress={loadSession} style={styles.retryBtn}>
          <Text style={styles.retryText}>Erneut versuchen</Text>
        </Pressable>
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>Trainingseinheit nicht gefunden.</Text>
      </View>
    );
  }

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
            <Ionicons name="barbell-outline" size={s(36)} color={COLORS.gold} />
          </View>
          <Text style={styles.title}>{session.dayName}</Text>
          <Text style={styles.subtitle}>
            {formatTrainingSessionDate(session.performedAt)}
          </Text>
        </View>

        {session.note ? (
          <View style={styles.trainingSessionDetailNoteBox}>
            <Text style={styles.trainingSessionDetailNoteTitle}>Notiz zur Einheit</Text>
            <Text style={styles.trainingSessionDetailNoteText}>{session.note}</Text>
          </View>
        ) : null}

        <Text style={styles.sectionLabel}>ÜBUNGEN</Text>

        {session.exercises.map((exercise, index) => (
          <View key={exercise.id} style={styles.trainingSessionExerciseCard}>
            <View style={styles.sessionExerciseHeader}>
              <Text style={styles.sessionExerciseIndex}>{index + 1}</Text>

              <View style={styles.sessionExerciseTitleWrap}>
                <Text style={styles.sessionExerciseName}>
                  {exercise.exercise_name}
                </Text>

                <Text style={styles.sessionExerciseHint}>
                  {exercise.weight ?? '-'} kg · {exercise.sets ?? '-'} Sätze · {exercise.reps ?? '-'} Wdh.
                </Text>
              </View>
            </View>

            {exercise.note ? (
              <Text style={styles.trainingSessionExerciseNote}>
                {exercise.note}
              </Text>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}