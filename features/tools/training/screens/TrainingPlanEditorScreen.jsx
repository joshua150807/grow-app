import { View, Text, Pressable, ActivityIndicator } from 'react-native';

import { COLORS } from '../../../../constants/colors';
import { useTrainingPlan } from '../hooks/useTrainingPlan';
import { TrainingPlanEditorView } from '../components/TrainingPlanEditorView';
import { styles } from '../styles/trainingStyles';
import { useDelayedLoading } from '../../../../hooks/useDelayedLoading';

export default function TrainingPlanEditorScreen() {
  const {
    plan,
    loading,
    error,
    loadPlan,
    addExercise,
    updateExercise,
    removeExercise,
    removePlan,
    renameDay,
    addDay,
  } = useTrainingPlan();

  const showLoading = useDelayedLoading(loading);

  if (showLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={COLORS.gold} size="large" />
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
      <View style={styles.centered}>
        <Text style={styles.emptyText}>Noch kein Trainingsplan vorhanden.</Text>
      </View>
    );
  }

  return (
    <TrainingPlanEditorView
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