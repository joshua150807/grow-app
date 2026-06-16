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
  chest: require('../../../../assets/training-anatomy/chest.webp'),
  back: require('../../../../assets/training-anatomy/back.webp'),
};

const TAB_BAR_SPACE = sv(88);
const IMAGE_HORIZONTAL_PADDING = s(6);
const IMAGE_ASPECT_RATIO = 941 / 1672;

export default function TrainingMuscleGroupAnatomyScreen() {
  const { groupId } = useLocalSearchParams();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const group = MUSCLE_GROUP_EXERCISES[groupId];
  const details = getMuscleGroupDetails(groupId);
  const anatomyImage = ANATOMY_IMAGES[groupId];

  const imageSize = useMemo(() => {
    const maxWidth = screenWidth - IMAGE_HORIZONTAL_PADDING * 2;
    const maxHeight = screenHeight - TAB_BAR_SPACE;

    let width = maxWidth;
    let height = width / IMAGE_ASPECT_RATIO;

    if (height > maxHeight) {
      height = maxHeight;
      width = height * IMAGE_ASPECT_RATIO;
    }

    return {
      width: Math.round(width),
      height: Math.round(height),
    };
  }, [screenHeight, screenWidth]);

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

  if (anatomyImage) {
    return (
      <View style={styles.anatomyPosterScreen}>
        <Image
          source={anatomyImage}
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
          <Ionicons name="body-outline" size={s(58)} color={COLORS.gold} />
          <Text style={styles.muscleAnatomyImageText}>Anatomiebild noch nicht hinterlegt</Text>
        </View>
      </ScrollView>
    </View>
  );
}
