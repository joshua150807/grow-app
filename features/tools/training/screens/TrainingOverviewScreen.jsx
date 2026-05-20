import { useCallback, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';

import { COLORS } from '../../../../constants/colors';
import { useTrainingPlan } from '../hooks/useTrainingPlan';
import { SetupView } from '../components/SetupView';
import { OverviewView } from '../components/OverviewView';
import { styles } from '../styles/trainingStyles';
import { useFocusEffect } from 'expo-router';

export default function TrainingOverviewScreen() {
  const {
    plan,
    loading,
    error,
    loadPlan,
    savePlan,
  } = useTrainingPlan();

  const [showSetup, setShowSetup] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (plan && !showSetup) {
        loadPlan({ silent: true });
      }
    }, [plan, showSetup, loadPlan])
  );

  const handleSavePlan = useCallback(
    async (planName, daysData) => {
      await savePlan(planName, daysData);
      setShowSetup(false);
      await loadPlan({ silent: true });
    },
    [savePlan, loadPlan]
  );

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

  if (!plan || showSetup) {
    return (
      <SetupView
        onSave={handleSavePlan}
        existingPlan={plan}
        onCancel={plan ? () => setShowSetup(false) : undefined}
      />
    );
  }

  return (
    <OverviewView
      plan={plan}
      onChangePlan={() => setShowSetup(true)}
    />
  );
}