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
import { getMuscleGroupDetails } from '../utils/muscleGroupDetails';

export default function TrainingMuscleGroupAnatomyScreen() {
  const { groupId } = useLocalSearchParams();
  const group = MUSCLE_GROUP_EXERCISES[groupId];
  const details = getMuscleGroupDetails(groupId);

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
          <Text style={styles.muscleAnatomyImageText}>Muskelbild hier einsetzen</Text>
        </View>

        <View style={styles.exerciseDetailCard}>
          <Text style={styles.exerciseDetailSectionTitle}>{details.anatomyTitle}</Text>
          <Text style={styles.exerciseDetailText}>{details.anatomyDescription}</Text>
        </View>

        <View style={styles.exerciseDetailCard}>
          <Text style={styles.exerciseDetailSectionTitle}>Wichtige Bereiche</Text>

          {details.anatomyParts.map((part, index) => (
            <View key={`${part}-${index}`} style={styles.exerciseDetailBulletRow}>
              <View style={styles.exerciseDetailBullet}>
                <Text style={styles.exerciseDetailBulletNumber}>{index + 1}</Text>
              </View>
              <Text style={styles.exerciseDetailBulletText}>{part}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
