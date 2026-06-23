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

  const handleGoBack = () => {
    router.back();
  };

  const handleOpenExerciseDetail = (exerciseId) => {
    router.push({
      pathname: '/tools/training-exercise-detail',
      params: { exerciseId },
    });
  };

  const handleOpenGroupDescription = () => {
    router.push({
      pathname: '/tools/training-muscle-group-description',
      params: { groupId },
    });
  };

  const handleOpenGroupAnatomy = () => {
    router.push({
      pathname: '/tools/training-muscle-group-anatomy',
      params: { groupId },
    });
  };

  if (!group) {
    return (
      <View style={styles.screen}>
        <View style={styles.topBar}>
          <Pressable
            onPress={handleGoBack}
            style={styles.backButton}
            hitSlop={8}
          >
            <Ionicons
              name="chevron-back"
              size={s(24)}
              color={COLORS.softGold}
            />
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
          onPress={handleGoBack}
          style={styles.backButton}
          hitSlop={8}
        >
          <Ionicons
            name="chevron-back"
            size={s(24)}
            color={COLORS.softGold}
          />
          <Text style={styles.backText}>Trainingsplan</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.muscleExerciseHeaderCompact}>
          <Text style={styles.title}>{group.label}</Text>

          <Text style={styles.muscleExerciseSubtitle}>
            {group.subtitle}
          </Text>
        </View>

        <View style={styles.muscleGroupInfoCardList}>
          <Pressable
            style={styles.exerciseDirectoryItem}
            onPress={handleOpenGroupDescription}
            hitSlop={4}
            android_ripple={{ color: 'rgba(212,175,55,0.10)' }}
          >
            <View style={styles.exerciseDirectoryIcon}>
              <Ionicons
                name="document-text-outline"
                size={s(24)}
                color={COLORS.softGold}
              />
            </View>

            <View style={styles.exerciseDirectoryContent}>
              <Text style={styles.exerciseDirectoryName}>
                Beschreibung
              </Text>

              <Text style={styles.exerciseDirectoryCategory}>
                Muskelgruppe allgemein erklärt
              </Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={s(20)}
              color={COLORS.textFaint}
            />
          </Pressable>

          <Pressable
            style={styles.exerciseDirectoryItem}
            onPress={handleOpenGroupAnatomy}
            hitSlop={4}
            android_ripple={{ color: 'rgba(212,175,55,0.10)' }}
          >
            <View style={styles.exerciseDirectoryIcon}>
              <Ionicons
                name="body-outline"
                size={s(24)}
                color={COLORS.softGold}
              />
            </View>

            <View style={styles.exerciseDirectoryContent}>
              <Text style={styles.exerciseDirectoryName}>
                Anatomie
              </Text>

              <Text style={styles.exerciseDirectoryCategory}>
                Aufbau und Funktion des Muskels
              </Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={s(20)}
              color={COLORS.textFaint}
            />
          </Pressable>
        </View>

        <View style={styles.exerciseSectionHeaderWrap}>
          <Text style={styles.exerciseSectionTitle}>Übungen</Text>
        </View>

        <View style={styles.exerciseDirectoryList}>
          {group.exercises.map((exercise) => (
            <Pressable
              key={exercise.id}
              style={styles.exerciseDirectoryItem}
              onPress={() => handleOpenExerciseDetail(exercise.id)}
              hitSlop={4}
              android_ripple={{ color: 'rgba(212,175,55,0.10)' }}
            >
              <View style={styles.exerciseDirectoryIcon}>
                <Ionicons
                  name="fitness-outline"
                  size={s(24)}
                  color={COLORS.softGold}
                />
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
