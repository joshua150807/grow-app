import {
  View,
  Text,
  ScrollView,
  Pressable,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../../../../constants/colors';
import { s } from '../../../../constants/layout';
import { styles } from '../styles/trainingStyles';
import { MUSCLE_GROUP_EXERCISES } from '../utils/muscleGroupExercises';

function findExerciseById(exerciseId) {
  const groups = Object.values(MUSCLE_GROUP_EXERCISES);

  for (const group of groups) {
    const exercise = group.exercises.find((item) => item.id === exerciseId);

    if (exercise) {
      return {
        exercise,
        group,
      };
    }
  }

  return null;
}

export default function TrainingExerciseDetailScreen() {
  const { exerciseId } = useLocalSearchParams();

  const result = findExerciseById(exerciseId);

  if (!result) {
    return (
      <View style={styles.screen}>
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backButton}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={s(24)} color={COLORS.softGold} />
            <Text style={styles.backText}>Zurück</Text>
          </Pressable>
        </View>

        <View style={styles.centered}>
          <Text style={styles.errorText}>
            Übung konnte nicht gefunden werden.
          </Text>
        </View>
      </View>
    );
  }

  const { exercise, group } = result;

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={s(24)} color={COLORS.softGold} />
          <Text style={styles.backText}>{group.label}</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.exerciseDetailHeader}>
          <Text style={styles.title}>{exercise.name}</Text>

          <Text style={styles.exerciseDetailCategory}>
            {exercise.category}
          </Text>
        </View>

        <View style={styles.exerciseDetailCard}>
          <Text style={styles.exerciseDetailSectionTitle}>
            Erklärung
          </Text>

          <Text style={styles.exerciseDetailText}>
            {exercise.description || 'Für diese Übung wurde noch keine Erklärung hinterlegt.'}
          </Text>
        </View>

        <View style={styles.exerciseDetailCard}>
          <Text style={styles.exerciseDetailSectionTitle}>
            Ausführung
          </Text>

          {(exercise.execution || []).map((step, index) => (
            <View key={`${step}-${index}`} style={styles.exerciseDetailBulletRow}>
              <View style={styles.exerciseDetailBullet}>
                <Text style={styles.exerciseDetailBulletNumber}>
                  {index + 1}
                </Text>
              </View>

              <Text style={styles.exerciseDetailBulletText}>
                {step}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.exerciseDetailCard}>
          <Text style={styles.exerciseDetailSectionTitle}>
            Hinweise
          </Text>

          {(exercise.tips || []).map((tip, index) => (
            <View key={`${tip}-${index}`} style={styles.exerciseDetailTipRow}>
              <Ionicons name="checkmark-circle-outline" size={s(18)} color={COLORS.softGold} />

              <Text style={styles.exerciseDetailTipText}>
                {tip}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}