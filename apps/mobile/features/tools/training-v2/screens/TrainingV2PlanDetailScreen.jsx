import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { COLORS } from '../../../../constants/colors';
import { TrainingV2StateView } from '../components/TrainingV2StateView';
import { useTrainingV2PlanDetail } from '../hooks/useTrainingV2PlanDetail';
import { targetSetLabel } from '../models/trainingV2ViewModel';
import { styles } from '../styles/trainingV2Styles';

export default function TrainingV2PlanDetailScreen() {
  const params = useLocalSearchParams();
  const planId = Array.isArray(params.planId) ? params.planId[0] : params.planId;
  const { plan, loading, refreshing, error, retry, refresh } = useTrainingV2PlanDetail(planId);

  if (loading || error) {
    return <TrainingV2StateView loading={loading} error={error} onRetry={retry} />;
  }
  if (!plan) return null;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={(
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={COLORS.softGold} />
      )}
      style={styles.screen}
    >
      <View style={styles.topRow}>
        <Text onPress={() => router.back()} style={styles.backText}>‹ Zurück</Text>
        <Text style={styles.title}>Plandetail</Text>
      </View>

      <View style={styles.detailHeader}>
        <Text style={styles.detailName}>{plan.name}</Text>
        <Text style={styles.detailMeta}>Status: {plan.statusLabel}</Text>
        {plan.schedule ? (
          <Text style={styles.detailMeta}>
            Start: {plan.schedule.startDate} · {plan.schedule.timeZone}
          </Text>
        ) : null}
        <Text style={styles.detailMeta}>
          Wochenziel: {plan.weeklyGoal ?? 'nicht festgelegt'}
        </Text>
        <Text style={styles.detailMeta}>Revision {plan.revision.revisionNumber}</Text>
      </View>

      {plan.units.map((unit) => (
        <View key={unit.id} style={styles.unitCard}>
          <Text style={styles.unitName}>{unit.name}</Text>
          <Text style={styles.unitType}>{unit.unitTypeLabel}</Text>
          {unit.exercises.map((exercise) => (
            <View key={exercise.id} style={styles.exercise}>
              <Text style={styles.exerciseName}>{exercise.exerciseName}</Text>
              {exercise.note ? <Text style={styles.exerciseNote}>{exercise.note}</Text> : null}
              {exercise.targetSets.map((targetSet, index) => (
                <Text key={targetSet.id} style={styles.setText}>
                  Satz {index + 1}: {targetSetLabel(targetSet)}
                </Text>
              ))}
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

