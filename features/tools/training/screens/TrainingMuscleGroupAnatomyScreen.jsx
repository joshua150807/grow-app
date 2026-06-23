import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  useWindowDimensions,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../../../../constants/colors';
import { s, sv } from '../../../../constants/layout';
import { styles } from '../styles/trainingStyles';
import { MUSCLE_GROUP_EXERCISES } from '../utils/muscleGroupExercises';
import { getMuscleGroupDetails } from '../utils/muscleGroupDetails';

const ANATOMY_IMAGES = {
  chest: {
    source: require('../../../../assets/training-anatomy/chest.webp'),
    aspectRatio: 941 / 1672,
  },
  back: {
    source: require('../../../../assets/training-anatomy/back.webp'),
    aspectRatio: 941 / 1672,
  },
  legs: {
    source: require('../../../../assets/training-anatomy/legs.webp'),
    aspectRatio: 1024 / 1536,
  },
  shoulders: {
    source: require('../../../../assets/training-anatomy/shoulders.webp'),
    aspectRatio: 1024 / 1536,
  },
  biceps: {
    source: require('../../../../assets/training-anatomy/biceps.webp'),
    aspectRatio: 853 / 1844,
  },
  triceps: {
    source: require('../../../../assets/training-anatomy/triceps.webp'),
    aspectRatio: 1024 / 1536,
  },
};

const TAB_BAR_SPACE = sv(88);
const IMAGE_HORIZONTAL_PADDING = s(6);

export default function TrainingMuscleGroupAnatomyScreen() {
  const { groupId } = useLocalSearchParams();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const group = MUSCLE_GROUP_EXERCISES[groupId];
  const details = getMuscleGroupDetails(groupId);
  const anatomyPoster = ANATOMY_IMAGES[groupId];

  const imageSize = useMemo(() => {
    const maxWidth = screenWidth - IMAGE_HORIZONTAL_PADDING * 2;
    const maxHeight = screenHeight - TAB_BAR_SPACE;

    let width = maxWidth;
    const aspectRatio = anatomyPoster?.aspectRatio ?? 941 / 1672;

    let height = width / aspectRatio;

    if (height > maxHeight) {
      height = maxHeight;
      width = height * aspectRatio;
    }

    return {
      width: Math.round(width),
      height: Math.round(height),
    };
  }, [anatomyPoster?.aspectRatio, screenHeight, screenWidth]);

  if (!group || !details) {
    return (
      <View style={styles.screen}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
            <Ionicons name="chevron-back" size={s(24)} color={COLORS.softGold} />
            <Text style={styles.backText}>Zurück</Text>
          </Pressable>
        </View>

        <View style={styles.centered}>
          <Text style={styles.errorText}>Anatomie konnte nicht gefunden werden.</Text>
        </View>
      </View>
    );
  }

  if (anatomyPoster) {
    return (
      <View style={styles.anatomyPosterScreen}>
        <Image
          source={anatomyPoster.source}
          style={[styles.anatomyPosterImage, imageSize]}
          resizeMode="contain"
        />

        <Pressable onPress={() => router.back()} style={styles.anatomyPosterBackButton} hitSlop={10}>
          <Ionicons name="chevron-back" size={s(24)} color={COLORS.softGold} />
          <Text style={styles.anatomyPosterBackText}>{group.label}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
          <Ionicons name="chevron-back" size={s(24)} color={COLORS.softGold} />
          <Text style={styles.backText}>{group.label}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.exerciseDetailHeaderCompact}>
          <Text style={styles.title}>Anatomie</Text>
          <Text style={styles.exerciseDetailCategory}>{group.label}</Text>
        </View>

        <View style={styles.muscleAnatomyImagePlaceholder}>
          <Ionicons name="body-outline" size={s(58)} color={COLORS.softGold} />
          <Text style={styles.muscleAnatomyImageText}>Anatomiebild noch nicht hinterlegt</Text>
        </View>
      </ScrollView>
    </View>
  );
}
