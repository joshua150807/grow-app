import { useCallback } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';

import { COLORS } from '../../../../constants/colors';
import { useTrainingPlan } from '../hooks/useTrainingPlan';
import { SetupView } from '../components/SetupView';
import { OverviewView } from '../components/OverviewView';
import { styles } from '../styles/trainingStyles';
import { router, useFocusEffect } from 'expo-router';
import { useDelayedLoading } from '../../../../hooks/useDelayedLoading';

export default function TrainingOverviewScreen() {
  const {
    plan,
    loading,
    error,
    loadPlan,
    savePlan,
  } = useTrainingPlan();

  const showLoading = useDelayedLoading(loading);

  useFocusEffect(
    useCallback(() => {
      if (plan) {
        loadPlan({ silent: true });
      }
    }, [plan, loadPlan])
  );

  const handleSavePlan = useCallback(
    async (planName, daysData) => {
      await savePlan(planName, daysData);
      await loadPlan({ silent: true });
    },
    [savePlan, loadPlan]
  );

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

  if (!plan) {
    return (
      <SetupView
        onSave={handleSavePlan}
        existingPlan={plan}
        onCancel={undefined}
      />
    );
  }

  return (
    <OverviewView
      plan={plan}
      onChangePlan={() => router.push('/tools/training-plan-setup')}
    />
  );
}