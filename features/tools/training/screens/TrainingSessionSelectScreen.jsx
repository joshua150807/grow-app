import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../../../../constants/colors';
import { s } from '../../../../constants/layout';
import { useTrainingPlan } from '../hooks/useTrainingPlan';
import { styles } from '../styles/trainingStyles';

export default function TrainingSessionSelectScreen() {
  const { plan, loading, error, loadPlan } = useTrainingPlan();

  const handleSelectDay = (day) => {
    router.push({
        pathname: '/tools/training-session-active',
        params: { dayId: day.id },
    })
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={COLORS.gold} size="large" />
        <Text style={styles.loadingText}>Trainingsplan wird geladen...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable onPress={loadPlan} style={styles.retryBtn}>
          <Text style={styles.retryText}>Erneut versuchen</Text>
        </Pressable>
      </View>
    );
  }

  if (!plan) {
    return (
      <View style={styles.screen}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={s(24)} color={COLORS.softGold} />
            <Text style={styles.backText}>Zurück</Text>
          </Pressable>
        </View>

        <View style={styles.centered}>
          <Text style={styles.emptyText}>Du hast noch keinen Trainingsplan.</Text>
        </View>
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
            <Ionicons name="play-outline" size={s(36)} color={COLORS.gold} />
          </View>
          <Text style={styles.title}>TRAINING STARTEN</Text>
          <Text style={styles.subtitle}>Wähle deinen heutigen Trainingstag</Text>
        </View>

        <Text style={styles.sectionLabel}>TRAININGSTAGE</Text>

        {plan.days.map((day) => (
          <Pressable
            key={day.id}
            style={styles.trainingDaySelectCard}
            onPress={() => handleSelectDay(day)}
          >
            <View style={styles.trainingDaySelectIconWrap}>
              <Ionicons name="barbell-outline" size={s(22)} color={COLORS.gold} />
            </View>

            <View style={styles.trainingDaySelectContent}>
              <Text style={styles.trainingDaySelectTitle}>{day.name}</Text>
              <Text style={styles.trainingDaySelectSubtitle}>
                {day.exercises?.length || 0}{' '}
                {(day.exercises?.length || 0) === 1 ? 'Übung' : 'Übungen'}
              </Text>
            </View>

            <Ionicons name="chevron-forward" size={s(20)} color={COLORS.textDim} />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}