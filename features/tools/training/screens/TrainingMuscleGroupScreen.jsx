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

export default function TrainingMuscleGroupScreen() {
  const { groupId } = useLocalSearchParams();

  const group = MUSCLE_GROUP_EXERCISES[groupId];

  if (!group) {
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
            Muskelgruppe konnte nicht gefunden werden.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={s(24)} color={COLORS.softGold} />
          <Text style={styles.backText}>Trainingsplan</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.muscleExerciseHeader}>
          <View style={styles.iconCircle}>
            <Ionicons name="barbell-outline" size={s(34)} color={COLORS.gold} />
          </View>

          <Text style={styles.title}>{group.label}</Text>

          <Text style={styles.muscleExerciseSubtitle}>
            {group.subtitle}
          </Text>
        </View>

        <View style={styles.exerciseDirectoryList}>
          {group.exercises.map((exercise) => (
            <Pressable
              key={exercise.id}
              style={styles.exerciseDirectoryItem}
              hitSlop={4}
            >
              <View style={styles.exerciseDirectoryIcon}>
                <Ionicons name="fitness-outline" size={s(24)} color={COLORS.gold} />
              </View>

              <View style={styles.exerciseDirectoryContent}>
                <Text style={styles.exerciseDirectoryName}>
                  {exercise.name}
                </Text>

                <Text style={styles.exerciseDirectoryCategory}>
                  {exercise.category}
                </Text>
              </View>

              <Ionicons
                name="chevron-forward"
                size={s(20)}
                color={COLORS.textFaint}
              />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}