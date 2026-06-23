import { useCallback } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';

import { COLORS } from '../../../../constants/colors';
import { useDelayedLoading } from '../../../../hooks/useDelayedLoading';
import { SetupView } from '../components/SetupView';
import { useTrainingPlan } from '../hooks/useTrainingPlan';
import { styles } from '../styles/trainingStyles';

export default function TrainingPlanSetupScreen() {
  const {
    plan,
    loading,
    error,
    loadPlan,
    savePlan,
  } = useTrainingPlan();

  const showLoading = useDelayedLoading(loading);

  const handleSavePlan = useCallback(
    async (planName, daysData) => {
      await savePlan(planName, daysData);
      router.back();
    },
    [savePlan]
  );

  const handleCancel = useCallback(() => {
    router.back();
  }, []);

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
        <Pressable onPress={loadPlan} style={styles.retryBtn}>
          <Text style={styles.retryText}>Erneut versuchen</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <SetupView
      onSave={handleSavePlan}
      existingPlan={plan}
      onCancel={handleCancel}
    />
  );
}
