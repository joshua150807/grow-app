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

export default function TrainingMuscleGroupDescriptionScreen() {
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
          <Text style={styles.errorText}>Beschreibung konnte nicht gefunden werden.</Text>
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
          <Text style={styles.title}>Beschreibung</Text>
          <Text style={styles.exerciseDetailCategory}>{group.label}</Text>
        </View>

        <View style={styles.exerciseDetailCard}>
          <Text style={styles.exerciseDetailSectionTitle}>{details.descriptionTitle}</Text>
          <Text style={styles.exerciseDetailText}>{details.description}</Text>
        </View>

        <View style={styles.exerciseDetailCard}>
          <Text style={styles.exerciseDetailSectionTitle}>Worauf du achten solltest</Text>

          {details.focusPoints.map((point, index) => (
            <View key={`${point}-${index}`} style={styles.exerciseDetailTipRow}>
              <Ionicons name="checkmark-circle-outline" size={s(18)} color={COLORS.softGold} />
              <Text style={styles.exerciseDetailTipText}>{point}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
