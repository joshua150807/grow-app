import { useCallback, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { COLORS } from '../../../../constants/colors';
import { TrainingV2PlanActionsPanel } from '../components/TrainingV2PlanActionsPanel';
import { TrainingV2ScheduleModal } from '../components/TrainingV2ScheduleModal';
import { TrainingV2StateView } from '../components/TrainingV2StateView';
import { TrainingV2WeeklyGoalModal } from '../components/TrainingV2WeeklyGoalModal';
import { useTrainingV2PlanActions } from '../hooks/useTrainingV2PlanActions';
import { useTrainingV2PlanDetail } from '../hooks/useTrainingV2PlanDetail';
import { shouldClosePlanActionModal, targetSetLabel } from '../models/trainingV2ViewModel';
import { styles } from '../styles/trainingV2Styles';

function actionErrorMessage(error) {
  if (!error) return null;
  return error.message ?? 'Die Aktion konnte nicht ausgeführt werden.';
}

export default function TrainingV2PlanDetailScreen() {
  const params = useLocalSearchParams();
  const planId = Array.isArray(params.planId) ? params.planId[0] : params.planId;
  const {
    plan, loading, refreshing, error, retry, refresh, applyServerPlan,
  } = useTrainingV2PlanDetail(planId);
  const actions = useTrainingV2PlanActions(planId, applyServerPlan);
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [weeklyGoalModalVisible, setWeeklyGoalModalVisible] = useState(false);

  const confirmAndRun = useCallback((title, message, run) => {
    Alert.alert(title, message, [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Bestätigen', style: 'destructive', onPress: () => { void run(); } },
    ]);
  }, []);

  const handleActivate = useCallback(() => {
    confirmAndRun(
      'Plan sofort aktivieren',
      'Ein aktuell aktiver Plan wird dabei automatisch archiviert. Fortfahren?',
      () => actions.activate(plan.version),
    );
  }, [actions, confirmAndRun, plan]);

  const handleArchive = useCallback(() => {
    confirmAndRun(
      'Plan archivieren',
      'Der Plan wird archiviert und ist danach nicht mehr aktiv oder vorgemerkt. Fortfahren?',
      () => actions.archive(plan.version),
    );
  }, [actions, confirmAndRun, plan]);

  const handleReactivate = useCallback(() => {
    confirmAndRun(
      'Plan reaktivieren',
      'Der Plan wird sofort aktiviert und startet wieder bei der ersten Einheit. Fortfahren?',
      () => actions.reactivate(plan.version),
    );
  }, [actions, confirmAndRun, plan]);

  const handleScheduleConfirm = useCallback((startDate, timeZone) => {
    void actions.schedule(plan.version, startDate, timeZone).then((outcome) => {
      if (shouldClosePlanActionModal(outcome)) setScheduleModalVisible(false);
    });
  }, [actions, plan]);

  const handleWeeklyGoalConfirm = useCallback((weeklyGoal) => {
    void actions.updateWeeklyGoal(plan.version, weeklyGoal).then((outcome) => {
      if (shouldClosePlanActionModal(outcome)) setWeeklyGoalModalVisible(false);
    });
  }, [actions, plan]);

  const handleReload = useCallback(() => {
    actions.clearError();
    void retry();
  }, [actions, retry]);

  const openScheduleModal = useCallback(() => {
    actions.clearError();
    setScheduleModalVisible(true);
  }, [actions]);

  const openWeeklyGoalModal = useCallback(() => {
    actions.clearError();
    setWeeklyGoalModalVisible(true);
  }, [actions]);

  const closeScheduleModal = useCallback(() => {
    actions.clearError();
    setScheduleModalVisible(false);
  }, [actions]);

  const closeWeeklyGoalModal = useCallback(() => {
    actions.clearError();
    setWeeklyGoalModalVisible(false);
  }, [actions]);

  if (loading || error) {
    return <TrainingV2StateView loading={loading} error={error} onRetry={retry} />;
  }
  if (!plan) return null;

  return (
    <>
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
          <Text
            onPress={() => router.push({ pathname: '/tools/training-v2-plan-editor', params: { planId } })}
            style={styles.editorLink}
          >
            Bearbeiten
          </Text>
        </View>

        {actions.conflict ? (
          <View style={styles.conflictBanner}>
            <Text style={styles.conflictBannerText}>
              Der Plan wurde in der Zwischenzeit auf dem Server geändert. Deine Ansicht wurde nicht überschrieben.
            </Text>
            <Pressable accessibilityRole="button" onPress={handleReload} style={styles.retryButton}>
              <Text style={styles.retryText}>Aktuellen Serverstand laden</Text>
            </Pressable>
          </View>
        ) : null}

        {actions.error && !actions.conflict ? (
          <View style={styles.conflictBanner}>
            <Text style={styles.conflictBannerText}>{actionErrorMessage(actions.error)}</Text>
          </View>
        ) : null}

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

        <TrainingV2PlanActionsPanel
          onActivate={handleActivate}
          onArchive={handleArchive}
          onEditWeeklyGoal={openWeeklyGoalModal}
          onReactivate={handleReactivate}
          onSchedule={openScheduleModal}
          pending={actions.pending}
          status={plan.status}
        />

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

      <TrainingV2ScheduleModal
        error={scheduleModalVisible ? actions.error : null}
        onClose={closeScheduleModal}
        onConfirm={handleScheduleConfirm}
        pending={actions.pending === 'schedule'}
        visible={scheduleModalVisible}
      />
      <TrainingV2WeeklyGoalModal
        currentValue={plan.weeklyGoal}
        error={weeklyGoalModalVisible ? actions.error : null}
        onClose={closeWeeklyGoalModal}
        onConfirm={handleWeeklyGoalConfirm}
        pending={actions.pending === 'weeklyGoal'}
        visible={weeklyGoalModalVisible}
      />
    </>
  );
}
