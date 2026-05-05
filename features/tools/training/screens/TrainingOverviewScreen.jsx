import { View, Text, Pressable, ActivityIndicator } from 'react-native';

import { COLORS } from '../../../../constants/colors';
import { useTrainingPlan } from '../hooks/useTrainingPlan';
import { SetupView } from '../components/SetupView';
import { OverviewView } from '../components/OverviewView';
import { styles } from '../styles/trainingStyles';

export default function TrainingOverviewScreen() {
  const {
    plan,
    loading,
    error,
    loadPlan,
    savePlan,
    addExercise,
    updateExercise,
    removeExercise,
    removePlan,
    renameDay,
    addDay,
  } = useTrainingPlan();

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
    return <SetupView onSave={savePlan} />;
  }

  return (
    <OverviewView
      plan={plan}
      onAddExercise={addExercise}
      onUpdateExercise={updateExercise}
      onDeleteExercise={removeExercise}
      onDeletePlan={removePlan}
      onRenameDay={renameDay}
      onAddDay={addDay}
    />
  );
}
