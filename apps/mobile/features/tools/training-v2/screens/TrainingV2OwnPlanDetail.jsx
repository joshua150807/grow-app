import { useCallback } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';

import { COLORS } from '../../../../constants/colors';
import { useTrainingV2PlanActions } from '../hooks/useTrainingV2PlanActions';
import { useTrainingV2PlanDetail } from '../hooks/useTrainingV2PlanDetail';
import { useTrainingV2Plans } from '../hooks/useTrainingV2Plans';
import { targetSetLabel } from '../models/trainingV2ViewModel';
import { styles } from '../styles/trainingV2Styles';
import { TrainingV2StateView } from '../components/TrainingV2StateView';
import { clearTrainingV2Draft, getTrainingV2DraftOwnerId } from '../services/trainingV2DraftStorage';
import {
  getCachedTrainingV2Plans,
  getTrainingV2PlansOwnerId,
  setCachedTrainingV2Plans,
} from '../services/trainingV2PlansCache';

function actionErrorMessage(error) {
  if (!error) return null;
  return error.message ?? 'Die Aktion konnte nicht ausgeführt werden.';
}

// Own plans (never tied to a Grow template) never get Save/Unsave — they are always
// considered "saved" by definition. The weekly-goal edit, the schedule-ahead action and the
// archive action are removed here entirely; only content, the edit flow and a single unified
// "Jetzt aktivieren" survive from the previous, larger action set.
export default function TrainingV2OwnPlanDetail({ planId }) {
  const {
    plan, loading, refreshing, error, retry, refresh, applyServerPlan,
  } = useTrainingV2PlanDetail(planId);
  const actions = useTrainingV2PlanActions(planId, applyServerPlan);
  const { plans: allPlans } = useTrainingV2Plans();

  const handleReload = useCallback(() => {
    actions.clearError();
    void retry();
  }, [actions, retry]);

  const runActivate = useCallback(() => {
    const task = plan.status === 'archived' ? actions.reactivate : actions.activate;
    void task(plan.version);
  }, [actions, plan]);

  const handleActivate = useCallback(() => {
    const otherActivePlan = allPlans.some((candidate) => (
      candidate.status === 'active' && candidate.id !== planId
    ));
    if (!otherActivePlan) {
      runActivate();
      return;
    }
    Alert.alert(
      'Plan sofort aktivieren',
      'Ein aktuell aktiver Plan wird dabei automatisch archiviert. Fortfahren?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Bestätigen', style: 'destructive', onPress: runActivate },
      ],
    );
  }, [allPlans, planId, runActivate]);

  // Runs after a confirmed, successful delete: no server plan is left to apply (see the
  // `applyResult: false` remove() call in useTrainingV2PlanActions.js), so this cleans up
  // everything client-side instead — the local edit draft (if any), this owner's cached
  // plans list (so the deleted plan can never flash back into "Gespeicherte Pläne" for an
  // instant before the Overview's own focus-refetch completes), and then navigates back to
  // the Overview exactly once via replace() (never back()), so the now-gone plan's detail
  // screen can never be returned to via the hardware/gesture back action either.
  const finishDelete = useCallback(async () => {
    const draftOwnerId = getTrainingV2DraftOwnerId();
    if (draftOwnerId) await clearTrainingV2Draft(draftOwnerId, 'edit', planId);
    const cacheOwnerId = getTrainingV2PlansOwnerId();
    const cachedPlans = getCachedTrainingV2Plans(cacheOwnerId);
    if (cachedPlans) {
      setCachedTrainingV2Plans(cacheOwnerId, cachedPlans.filter((cachedPlan) => cachedPlan.id !== planId));
    }
    router.replace({ pathname: '/tools/training-v2-plans' });
  }, [planId]);

  const runDelete = useCallback(() => {
    void actions.remove().then((outcome) => {
      if (outcome.ok) void finishDelete();
    });
  }, [actions, finishDelete]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Plan löschen',
      'Der Plan wird endgültig gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Plan löschen', style: 'destructive', onPress: runDelete },
      ],
    );
  }, [runDelete]);

  if (loading || error) {
    return <TrainingV2StateView loading={loading} error={error} onRetry={retry} />;
  }
  if (!plan) return null;

  const isActive = plan.status === 'active';

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
        <View style={styles.cardTop}>
          <Text style={styles.detailName}>{plan.name}</Text>
          {isActive ? (
            <View style={[styles.statusBadge, styles.statusBadgeActive]}>
              <Text style={[styles.statusBadgeText, styles.statusBadgeTextActive]}>Aktiv</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.detailMeta}>Revision {plan.revision.revisionNumber}</Text>
      </View>

      {!isActive ? (
        <View style={styles.actionsPanel}>
          <Pressable
            accessibilityRole="button"
            disabled={actions.pending !== null}
            onPress={handleActivate}
            style={[styles.actionButton, actions.pending !== null && styles.actionButtonDisabled]}
          >
            <Text style={styles.actionButtonText}>Jetzt aktivieren</Text>
          </Pressable>
        </View>
      ) : null}

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

      {plan.sourceTemplateId === null ? (
        <View style={styles.actionsPanel}>
          <Pressable
            accessibilityRole="button"
            disabled={actions.pending !== null}
            onPress={handleDelete}
            style={[styles.actionButtonDanger, actions.pending !== null && styles.actionButtonDisabled]}
          >
            <Text style={styles.actionButtonDangerText}>Plan löschen</Text>
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
}
