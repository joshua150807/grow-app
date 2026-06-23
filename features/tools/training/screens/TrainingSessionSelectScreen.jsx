import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../../../../constants/colors';
import { s } from '../../../../constants/layout';
import { useTrainingPlan } from '../hooks/useTrainingPlan';
import { styles } from '../styles/trainingStyles';
import { useDelayedLoading } from '../../../../hooks/useDelayedLoading';

const softPress = (baseStyle, disabled = false) => ({ pressed }) => [
  baseStyle,
  pressed && !disabled && { opacity: 0.92, transform: [{ scale: 0.985 }] },
];

function getDayType(day) {
  if (day?.type === 'run' || day?.day_type === 'run') return 'run';
  if (day?.type === 'rest' || day?.day_type === 'rest') return 'rest';
  return 'gym';
}

export default function TrainingSessionSelectScreen() {
  const { plan, loading, error, loadPlan } = useTrainingPlan();
  const showLoading = useDelayedLoading(loading);

  const handleSelectDay = (day) => {
    if (getDayType(day) === 'rest') return;

    router.push({
      pathname: '/tools/training-session-active',
      params: { dayId: day.id },
    });
  };

  if (showLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={COLORS.softGold} size="large" />
        <Text style={styles.loadingText}>Trainingsplan wird geladen...</Text>
      </View>
    );
  }

  if (loading) {
    return <View style={styles.screen} />;
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable onPress={loadPlan} style={softPress(styles.retryBtn)}>
          <Text style={styles.retryText}>Erneut versuchen</Text>
        </Pressable>
      </View>
    );
  }

  if (!plan) {
    return (
      <View style={styles.screen}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={softPress(styles.backButton)} hitSlop={s(8)}>
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
        <Pressable onPress={() => router.back()} style={softPress(styles.backButton)} hitSlop={s(8)}>
          <Ionicons name="chevron-back" size={s(24)} color={COLORS.softGold} />
          <Text style={styles.backText}>Zurück</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Training starten</Text>
          <Text style={styles.subtitle}>Wähle deinen heutigen Trainingstag</Text>
        </View>

        <Text style={styles.sectionLabel}>TRAININGSTAGE</Text>

        {plan.days.map((day) => {
          const exerciseCount = day.exercises?.length || 0;
          const dayType = getDayType(day);
          const isRunDay = dayType === 'run';
          const isRestDay = dayType === 'rest';

          return (
            <Pressable
              key={day.id}
              style={softPress([styles.trainingDaySelectCard, isRestDay && { opacity: 0.65 }], isRestDay)}
              onPress={() => handleSelectDay(day)}
              disabled={isRestDay}
            >
              <View style={styles.trainingDaySelectIconWrap}>
                <Ionicons
                  name={isRunDay ? 'walk-outline' : isRestDay ? 'moon-outline' : 'barbell-outline'}
                  size={s(22)}
                  color={COLORS.softGold}
                />
              </View>

              <View style={styles.trainingDaySelectContent}>
                <Text style={styles.trainingDaySelectTitle}>{day.name}</Text>
                <Text style={styles.trainingDaySelectSubtitle}>
                  {isRunDay
                    ? 'Laufeinheit'
                    : isRestDay
                      ? 'Rest Day / nicht speicherbar'
                      : `${exerciseCount} ${exerciseCount === 1 ? 'Übung' : 'Übungen'}`}
                </Text>
              </View>

              {!isRestDay ? (
                <Ionicons name="chevron-forward" size={s(20)} color={COLORS.textDim} />
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}